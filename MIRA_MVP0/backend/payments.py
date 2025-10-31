from fastapi import APIRouter, HTTPException, Request, Body, Header
from pydantic import BaseModel, Field, root_validator
from typing import Optional
import os
import stripe as stripe_lib
from settings import supabase, PRICE_ID_TO_PLAN, get_uid_from_token

router = APIRouter()

# Initialize Stripe with secret key from environment
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if STRIPE_SECRET_KEY:
	stripe_lib.api_key = STRIPE_SECRET_KEY


def _upsert_payment_record(stripe_id: str, payload: dict):
	"""Upsert a payment record into Supabase `payments` table, using a safe subset of columns."""
	allowed_cols = {
		"stripe_id",
		"checkout_session_id",
		"payment_intent",
		"uid",
		"amount",
		"currency",
		"status",
		"metadata",
		"raw_event",
	}
	safe_payload = {k: v for k, v in (payload or {}).items() if k in allowed_cols}
	if "stripe_id" not in safe_payload:
		safe_payload["stripe_id"] = stripe_id
	try:
		existing = supabase.table("payments").select("*").eq("stripe_id", stripe_id).execute()
		if existing.data and len(existing.data) > 0:
			supabase.table("payments").update(safe_payload).eq("stripe_id", stripe_id).execute()
		else:
			supabase.table("payments").insert(safe_payload).execute()
	except Exception as e:
		print("Error upserting payment record:", e)


def _get_user_profile(uid: str):
	try:
		resp = supabase.table("user_profile").select("*").eq("uid", uid).execute()
		if resp.data and len(resp.data) > 0:
			return resp.data[0]
	except Exception as e:
		print("Error fetching user profile:", e)
	return None


def _get_or_create_stripe_customer(uid: str):
	"""Get or create a Stripe Customer for the given uid. Requires user_profile.email."""
	profile = _get_user_profile(uid)
	if not profile:
		raise HTTPException(status_code=404, detail="User profile not found")

	customer_id = profile.get("stripe_customer_id")
	if customer_id:
		return customer_id

	email = profile.get("email")
	if not email:
		raise HTTPException(status_code=400, detail="User profile missing email")

	customer = stripe_lib.Customer.create(email=email, metadata={"uid": uid})
	try:
		supabase.table("user_profile").update({"stripe_customer_id": customer.id}).eq("uid", uid).execute()
	except Exception as e:
		print("Warning: failed to save stripe_customer_id:", e)
	return customer.id


class CheckoutSessionCreate(BaseModel):
	amount: Optional[int] = Field(None, description="Amount in cents (one-time payment)")
	currency: str = Field("usd", description="Currency code")
	name: Optional[str] = Field(None, description="Product name for one-time payments")
	success_url: str = Field(..., description="Success redirect URL")
	cancel_url: str = Field(..., description="Cancel redirect URL")
	uid: Optional[str] = Field(None, description="Internal user id")
	price_id: Optional[str] = Field(None, description="Stripe Price ID for subscriptions")
	plan_key: Optional[str] = Field(None, description="Internal plan key (e.g. 'advanced')")

	@root_validator(skip_on_failure=True)
	def must_have_price_or_amount(cls, values):
		amount, price_id, plan_key = values.get("amount"), values.get("price_id"), values.get("plan_key")
		if not price_id and not amount and not plan_key:
			raise ValueError("Provide 'plan_key' or 'price_id' for subscriptions, or 'amount' for one-time")
		return values

	model_config = {
		"json_schema_extra": {
			"example": {
				"success_url": "http://localhost:8000/payments-test?status=success",
				"cancel_url": "http://localhost:8000/payments-test?status=cancel",
				"uid": "a888418a-4c5b-41dd-a1e2-6245622ed7dc",
				"plan_key": "advanced"
			}
		}
	}


@router.post("/create-checkout-session")
async def create_checkout_session(payload: CheckoutSessionCreate = Body(...)):
	if not stripe_lib.api_key:
		raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")

	# Map plan_key -> price_id
	price_id = payload.price_id
	if payload.plan_key and not price_id:
		for pid, plan in PRICE_ID_TO_PLAN.items():
			if plan.get("key") == payload.plan_key:
				price_id = pid
				break

	metadata = {}
	if payload.uid:
		metadata["uid"] = payload.uid
	if payload.plan_key:
		metadata["plan_key"] = payload.plan_key

	# Resolve Stripe customer for uid
	customer_id = None
	if payload.uid:
		try:
			customer_id = _get_or_create_stripe_customer(payload.uid)
		except Exception as e:
			print("Warning: could not resolve Stripe customer:", e)

	try:
		# Subscription
		if price_id:
			# Verify monthly and fetch amount/currency
			price_obj = None
			mapped_plan = PRICE_ID_TO_PLAN.get(price_id)
			if mapped_plan:
				interval = mapped_plan.get("interval")
				if interval and interval != "month":
					raise HTTPException(status_code=400, detail=f"Price {price_id} is not a monthly plan (interval={interval})")
			try:
				price_obj = stripe_lib.Price.retrieve(price_id)
				recurring = price_obj.get("recurring")
				if not recurring or recurring.get("interval") != "month":
					raise HTTPException(status_code=400, detail=f"Price {price_id} is not a monthly subscription price")
			except stripe_lib.error.InvalidRequestError as e:
				raise HTTPException(status_code=400, detail=f"Invalid price_id: {price_id} - {str(e)}")

			session = stripe_lib.checkout.Session.create(
				mode="subscription",
				line_items=[{"price": price_id, "quantity": 1}],
				success_url=payload.success_url,
				cancel_url=payload.cancel_url,
				metadata={**metadata, "plan_price_id": price_id},
				subscription_data={"metadata": metadata or None},
				**({"customer": customer_id} if customer_id else {}),
			)

			# initial record
			try:
				amount_cents = price_obj.get("unit_amount") if price_obj else (payload.amount or 0)
				currency_code = price_obj.get("currency") if price_obj else payload.currency
				record = {
					"stripe_id": session.id,
					"checkout_session_id": session.id,
					"payment_intent": session.get("payment_intent"),
					"uid": payload.uid,
					"amount": amount_cents,
					"currency": currency_code,
					"status": "pending",
					"metadata": metadata or None,
					"raw_event": {"session_created": True, "id": session.id},
				}
				_upsert_payment_record(session.id, record)
			except Exception as e:
				print("Warning: failed to insert initial payment record:", e)

			return {"sessionId": session.id, "url": getattr(session, 'url', None)}

		# One-time
		else:
			session = stripe_lib.checkout.Session.create(
				payment_method_types=["card"],
				line_items=[{
					"price_data": {
						"currency": payload.currency,
						"product_data": {"name": payload.name or "MIRA One-time Payment"},
						"unit_amount": int(payload.amount),
					},
					"quantity": 1,
				}],
				mode="payment",
				success_url=payload.success_url,
				cancel_url=payload.cancel_url,
				metadata=metadata or None,
				**({"customer": customer_id} if customer_id else {}),
			)

			try:
				record = {
					"stripe_id": session.id,
					"checkout_session_id": session.id,
					"payment_intent": session.get("payment_intent"),
					"uid": payload.uid,
					"amount": payload.amount,
					"currency": payload.currency,
					"status": "pending",
					"metadata": metadata or None,
					"raw_event": {"session_created": True, "id": session.id},
				}
				_upsert_payment_record(session.id, record)
			except Exception as e:
				print("Warning: failed to insert initial payment record:", e)

			return {"sessionId": session.id, "url": getattr(session, 'url', None)}

	except stripe_lib.error.InvalidRequestError as e:
		raise HTTPException(status_code=400, detail=str(e))
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


class PortalSessionCreate(BaseModel):
	return_url: str = Field(...)
	uid: str = Field(...)


@router.post("/create-portal-session")
async def create_billing_portal_session(payload: PortalSessionCreate = Body(...)):
	if not stripe_lib.api_key:
		raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY not configured")
	customer_id = _get_or_create_stripe_customer(payload.uid)
	session = stripe_lib.billing_portal.Session.create(customer=customer_id, return_url=payload.return_url)
	return {"url": session.url}


@router.get("/subscription-status")
async def get_subscription_status(uid: str):
	profile = _get_user_profile(uid)
	if not profile:
		return {"plan": None, "status": None, "subscription_id": None}

	status = profile.get("subscription_status")
	plan = profile.get("subscriptionPlan")
	sub_id = profile.get("stripe_subscription_id")
	if not sub_id or not status:
		try:
			customer_id = profile.get("stripe_customer_id")
			stripe_sub = None
			if sub_id:
				stripe_sub = stripe_lib.Subscription.retrieve(sub_id)
			elif customer_id:
				list_resp = stripe_lib.Subscription.list(customer=customer_id, status="all", limit=1)
				if list_resp and list_resp.get("data"):
					stripe_sub = list_resp["data"][0]
			if stripe_sub:
				status = stripe_sub.get("status")
				items = stripe_sub.get("items", {}).get("data", [])
				price_id = items[0]["price"]["id"] if items else None
				mapped = PRICE_ID_TO_PLAN.get(price_id) if price_id else None
				plan = mapped.get("key") if mapped else plan
				sub_id = stripe_sub.get("id")
				supabase.table("user_profile").update({
					"subscription_status": status,
					"subscriptionPlan": plan,
					"stripe_subscription_id": sub_id,
				}).eq("uid", uid).execute()
		except Exception:
			pass

	return {"plan": plan, "status": status, "subscription_id": sub_id}


class CancelSubscriptionRequest(BaseModel):
	uid: Optional[str] = Field(None, description="Internal user id (optional if subscription_id provided)")
	subscription_id: Optional[str] = Field(None, description="Stripe subscription id to cancel directly")
	cancel_at_period_end: bool = Field(True)


@router.post("/cancel-subscription")
async def cancel_subscription(payload: CancelSubscriptionRequest = Body(...), authorization: str = Header(None)):
	# If subscription_id is provided, cancel directly without DB lookups
	sub_id = payload.subscription_id
	if not sub_id:
		resolved_uid = payload.uid
		if not resolved_uid and authorization:
			try:
				resolved_uid = get_uid_from_token(authorization)
			except Exception:
				pass
		if not resolved_uid:
			raise HTTPException(status_code=400, detail="Provide subscription_id or send Authorization header for user")
		profile = _get_user_profile(resolved_uid) if resolved_uid else None
		sub_id = None
		# Try from profile first
		if profile:
			sub_id = profile.get("stripe_subscription_id")
			if not sub_id:
				customer_id = profile.get("stripe_customer_id")
				if customer_id:
					try:
						list_resp = stripe_lib.Subscription.list(customer=customer_id, status="active", limit=1)
						if list_resp and list_resp.get("data"):
							sub_id = list_resp["data"][0]["id"]
							supabase.table("user_profile").update({"stripe_subscription_id": sub_id}).eq("uid", resolved_uid).execute()
					except Exception:
						pass
		# If still missing and we have a token, derive by email -> customer
		if not sub_id and authorization:
			try:
				user_resp = supabase.auth.get_user(authorization.split(" ")[-1])
				email = getattr(user_resp.user, "email", None) if user_resp and user_resp.user else None
				if email:
					cust_list = stripe_lib.Customer.list(email=email, limit=1)
					if cust_list and cust_list.get("data"):
						cust_id = cust_list["data"][0]["id"]
						subs = stripe_lib.Subscription.list(customer=cust_id, status="active", limit=1)
						if subs and subs.get("data"):
							sub_id = subs["data"][0]["id"]
			except Exception:
				pass
		if not sub_id:
			raise HTTPException(status_code=400, detail="No active subscription on file for this UID")

	if payload.cancel_at_period_end:
		sub = stripe_lib.Subscription.modify(sub_id, cancel_at_period_end=True)
	else:
		sub = stripe_lib.Subscription.delete(sub_id)

	try:
		if payload.uid or authorization:
			# prefer resolved uid if we derived it
			target_uid = payload.uid
			if not target_uid and authorization:
				try:
					target_uid = get_uid_from_token(authorization)
				except Exception:
					pass
			update = {"subscription_status": sub.get("status")}
			if sub.get("status") == "canceled":
				update.update({"subscriptionPlan": None, "stripe_subscription_id": None})
			if target_uid:
				supabase.table("user_profile").update(update).eq("uid", target_uid).execute()
	except Exception as e:
		print("Warning: failed to update subscription after cancel:", e)

	return {"status": sub.get("status"), "id": sub.get("id")}


@router.post("/webhook")
async def stripe_webhook(request: Request):
	payload = await request.body()
	sig_header = request.headers.get("stripe-signature")
	webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
	if not webhook_secret:
		raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET not configured")

	try:
		event = stripe_lib.Webhook.construct_event(payload, sig_header, webhook_secret)
	except ValueError:
		raise HTTPException(status_code=400, detail="Invalid payload")
	except stripe_lib.error.SignatureVerificationError:
		raise HTTPException(status_code=400, detail="Invalid signature")

	try:
		evt_type = event["type"]

		if evt_type == "checkout.session.completed":
			session = event["data"]["object"]
			subscription_id = session.get("subscription")
			metadata = session.get("metadata") or {}
			uid = metadata.get("uid")
			plan_price_id = metadata.get("plan_price_id")
			plan_key = metadata.get("plan_key")
			if uid:
				supabase.table("user_profile").update({"subscriptionPlan": plan_key, "stripe_subscription_id": subscription_id}).eq("uid", uid).execute()
			try:
				amount_cents = 0
				currency_code = session.get("currency") or "usd"
				pi_id = session.get("payment_intent")
				if subscription_id:
					try:
						sub_obj = stripe_lib.Subscription.retrieve(subscription_id, expand=["latest_invoice.payment_intent"])
						latest_invoice = sub_obj.get("latest_invoice")
						if latest_invoice:
							amount_cents = latest_invoice.get("amount_paid") or latest_invoice.get("amount_due") or 0
							currency_code = latest_invoice.get("currency") or currency_code
							pi = latest_invoice.get("payment_intent")
							if isinstance(pi, dict):
								pi_id = pi.get("id")
					except Exception:
						pass
				record = {
					"stripe_id": session.get("id"),
					"checkout_session_id": session.get("id"),
					"payment_intent": pi_id,
					"uid": uid,
					"amount": amount_cents,
					"currency": currency_code,
					"status": "completed",
					"metadata": {"uid": uid, "plan_key": plan_key, "plan_price_id": plan_price_id} if (uid or plan_key or plan_price_id) else None,
					"raw_event": event,
				}
				_upsert_payment_record(session.get("id"), record)
			except Exception as e:
				print("Warning: failed to upsert payment on session.completed:", e)

		elif evt_type == "payment_intent.succeeded":
			payment_intent = event["data"]["object"]
			pi_id = payment_intent.get("id")
			amount = payment_intent.get("amount")
			currency = payment_intent.get("currency")
			metadata = payment_intent.get("metadata") or {}
			record = {
				"stripe_id": pi_id,
				"payment_intent": pi_id,
				"amount": amount,
				"currency": currency,
				"status": "succeeded",
				"metadata": metadata or None,
				"raw_event": event,
			}
			_upsert_payment_record(pi_id, record)
		elif evt_type == "invoice.payment_succeeded":
			invoice = event["data"]["object"]
			amount_paid = invoice.get("amount_paid")
			currency = invoice.get("currency")
			pi = invoice.get("payment_intent")
			pi_id = pi.get("id") if isinstance(pi, dict) else pi
			record = {
				"stripe_id": pi_id or invoice.get("id"),
				"payment_intent": pi_id,
				"amount": amount_paid,
				"currency": currency,
				"status": "succeeded",
				"metadata": {"invoice_id": invoice.get("id"), "subscription": invoice.get("subscription")},
				"raw_event": event,
			}
			_upsert_payment_record(record["stripe_id"], record)
		elif evt_type == "customer.subscription.created":
			subscription = event["data"]["object"]
			subscription_id = subscription["id"]
			items = subscription.get("items", {}).get("data", [])
			plan_key = None
			if items:
				price_id = items[0]["price"]["id"]
				plan = PRICE_ID_TO_PLAN.get(price_id)
				plan_key = plan["key"] if plan else None
			uid = subscription.get("metadata", {}).get("uid")
			if uid:
				try:
					supabase.table("user_profile").update({
						"subscriptionPlan": plan_key,
						"stripe_subscription_id": subscription_id,
						"subscription_status": subscription.get("status")
					}).eq("uid", uid).execute()
				except Exception as e:
					print("Warning: failed to update subscription on create:", e)
		elif evt_type in ("customer.subscription.updated", "customer.subscription.deleted"):
			subscription = event["data"]["object"]
			uid = (subscription.get("metadata") or {}).get("uid")
			status = subscription.get("status")
			plan_key = None
			items = subscription.get("items", {}).get("data", [])
			if items:
				price_id = items[0]["price"]["id"]
				mapped = PRICE_ID_TO_PLAN.get(price_id)
				plan_key = mapped.get("key") if mapped else None
			if uid:
				update = {"subscription_status": status}
				if plan_key is not None:
					update["subscriptionPlan"] = plan_key
				if evt_type == "customer.subscription.deleted":
					update.update({"subscriptionPlan": None, "stripe_subscription_id": None})
				try:
					supabase.table("user_profile").update(update).eq("uid", uid).execute()
				except Exception as e:
					print("Warning: failed to update subscription on status change:", e)
	except Exception as e:
		print("Error handling webhook event:", e)

	return {"status": "received"}


@router.get("/payments-debug/payments")
async def list_recent_payments(limit: int = 10):
	try:
		resp = supabase.table("payments").select("*").order("created_at", desc=True).limit(limit).execute()
		return {"data": resp.data}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments-debug/profile")
async def get_profile_debug(uid: str):
	try:
		resp = supabase.table("user_profile").select("uid, email, firstName, lastName, subscriptionPlan, subscription_status, stripe_customer_id, stripe_subscription_id").eq("uid", uid).execute()
		return {"data": resp.data}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


class UpsertProfileRequest(BaseModel):
	uid: str = Field(...)
	email: str = Field(...)
	firstName: Optional[str] = Field(None)
	middleName: Optional[str] = Field(None)
	lastName: Optional[str] = Field(None)


@router.post("/payments-debug/upsert-profile")
async def upsert_profile_debug(payload: UpsertProfileRequest = Body(...)):
	"""Upsert a user_profile (meeting NOT NULL constraints) and ensure a Stripe customer id is stored."""
	try:
		profile_data = {
			"uid": payload.uid,
			"email": payload.email,
			"firstName": payload.firstName or "User",
			"middleName": payload.middleName,
			"lastName": payload.lastName or "",
		}
		try:
			supabase.table("user_profile").upsert(profile_data).execute()
		except Exception:
			existing = supabase.table("user_profile").select("*").eq("uid", payload.uid).execute()
			if existing.data and len(existing.data) > 0:
				supabase.table("user_profile").update(profile_data).eq("uid", payload.uid).execute()
			else:
				supabase.table("user_profile").insert(profile_data).execute()
		cust_id = _get_or_create_stripe_customer(payload.uid)
		return {"ok": True, "stripe_customer_id": cust_id}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


