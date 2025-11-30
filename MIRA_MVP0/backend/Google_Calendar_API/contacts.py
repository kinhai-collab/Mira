"""
Google Contacts/People API integration for looking up emails by name.
Also searches Gmail messages as a fallback for people not in contacts.
"""
import os
import re
from typing import List, Optional, Dict
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from .service import get_creds, _creds


def is_notification_or_bot_email(email: str) -> bool:
    """
    Check if an email address is from a notification service, bot, or automated system.
    These should be filtered out when looking up contacts.
    
    Args:
        email: Email address to check
        
    Returns:
        True if the email appears to be a notification/bot email
    """
    if not email:
        return True
    
    email_lower = email.lower()
    
    # Common notification/bot email patterns
    notification_patterns = [
        'notifications@',
        'noreply@',
        'no-reply@',
        'donotreply@',
        'do-not-reply@',
        'no_reply@',
        'automated@',
        'automation@',
        'bot@',
        'system@',
        'support@',
        'help@',
        'info@',
        'mailer@',
        'mailing@',
        'newsletter@',
        'alerts@',
        'updates@',
        'team@',  # Often used for team notifications
        'github.com',  # GitHub notifications
        'gitlab.com',  # GitLab notifications
        'slack.com',  # Slack notifications
        'trello.com',  # Trello notifications
        'asana.com',  # Asana notifications
        'jira.com',  # Jira notifications
        'atlassian.com',  # Atlassian notifications
    ]
    
    # Check if email contains any notification pattern
    for pattern in notification_patterns:
        if pattern in email_lower:
            return True
    
    # Check if it's a generic service email (like service@domain.com)
    local_part = email_lower.split('@')[0] if '@' in email_lower else ''
    if local_part in ['service', 'services', 'admin', 'administrator', 'postmaster', 'webmaster', 'hostmaster']:
        return True
    
    return False


def is_personal_email(email: str) -> bool:
    """
    Check if an email looks like a personal or work email (not a service).
    Personal emails typically have the person's name in the local part.
    
    Args:
        email: Email address to check
        
    Returns:
        True if the email looks like a personal/work email
    """
    if not email or '@' not in email:
        return False
    
    email_lower = email.lower()
    local_part = email_lower.split('@')[0]
    
    # Personal emails usually have:
    # - Name parts (letters, dots, hyphens, underscores)
    # - Not just numbers
    # - Not generic words like "notifications", "noreply", etc.
    
    # If it's just numbers or very short, probably not personal
    if len(local_part) < 3 or local_part.isdigit():
        return False
    
    # If it contains common personal name patterns (letters with dots/hyphens)
    if re.match(r'^[a-z]+([._-][a-z]+)*$', local_part):
        return True
    
    # If it's a mix of letters and numbers (like john.doe123)
    if re.match(r'^[a-z]+([._-][a-z]+)*[0-9]*$', local_part):
        return True
    
    return False


def search_contacts_by_name(uid: str, name: str, max_results: int = 10) -> List[Dict[str, str]]:
    """
    Search Google Contacts (People API) by name and return matching contacts with emails.
    
    Args:
        uid: User ID
        name: Name to search for (e.g., "Tony", "John Smith")
        max_results: Maximum number of results to return
        
    Returns:
        List of dicts with 'name' and 'email' keys, e.g.:
        [{'name': 'Tony Stark', 'email': 'tony@stark.com'}, ...]
    """
    try:
        print(f"📇 Searching Google Contacts for '{name}' (user: {uid})...")
        creds_row = get_creds(uid)
        if not creds_row:
            print(f"⚠️ No Google credentials found for user {uid}")
            return []
        
        credentials = _creds(creds_row)
        
        # Build People API service
        try:
            service = build("people", "v1", credentials=credentials)
        except Exception as build_error:
            print(f"⚠️ Failed to build People API service: {build_error}")
            return []
        
        # Search contacts by name
        try:
            results = service.people().searchContacts(
                query=name,
                readMask="names,emailAddresses",
                pageSize=max_results
            ).execute()
        except Exception as search_error:
            print(f"⚠️ People API search failed: {search_error}")
            # Check if it's a scope/permission issue
            if "insufficient" in str(search_error).lower() or "permission" in str(search_error).lower():
                print(f"⚠️ Missing People API permissions. Ensure contacts.readonly scope is granted.")
            return []
        
        contacts = []
        results_list = results.get("results", [])
        print(f"📇 People API returned {len(results_list)} result(s)")
        
        for person in results_list:
            try:
                person_data = person.get("person", {})
                
                # Extract name
                names = person_data.get("names", [])
                display_name = names[0].get("displayName", "") if names else ""
                
                # Extract email addresses
                emails = person_data.get("emailAddresses", [])
                if not emails:
                    print(f"  ⚠️ Contact '{display_name}' has no email addresses, skipping")
                    continue
                    
                for email_obj in emails:
                    email = email_obj.get("value", "")
                    if email:
                        contacts.append({
                            "name": display_name or email,
                            "email": email
                        })
                        print(f"  ✅ Found: {display_name or email} <{email}>")
                        # Only add first email per contact to avoid duplicates
                        break
            except Exception as person_error:
                print(f"  ⚠️ Error processing contact: {person_error}")
                continue
        
        print(f"📇 Found {len(contacts)} contact(s) with emails matching '{name}'")
        return contacts
        
    except Exception as e:
        print(f"⚠️ Error searching contacts for '{name}': {e}")
        import traceback
        traceback.print_exc()
        return []


def search_gmail_by_name(uid: str, name: str, max_results: int = 10) -> List[Dict[str, str]]:
    """
    Search Gmail messages (sent and received) for a name and extract email addresses.
    This is a fallback for people not saved in contacts.
    
    Args:
        uid: User ID
        name: Name to search for (e.g., "Tony", "John Smith")
        max_results: Maximum number of messages to check
        
    Returns:
        List of dicts with 'name' and 'email' keys from recent emails
    """
    try:
        creds_row = get_creds(uid)
        if not creds_row:
            print(f"⚠️ No Google credentials found for user {uid} in Gmail search")
            return []
        
        credentials = _creds(creds_row)
        gmail_service = build("gmail", "v1", credentials=credentials)
        
        # Better Gmail search: search for name in subject or body, then check headers
        # Gmail search syntax: search for the name as a phrase
        name_parts = name.split()
        if len(name_parts) > 1:
            # For multi-word names, search for all words
            query = " OR ".join([f'"{part}"' for part in name_parts])
        else:
            # For single word, search for it
            query = f'"{name}"'
        
        print(f"📧 Searching Gmail with query: {query}")
        
        # Search recent messages (last 50 to have better coverage)
        results = gmail_service.users().messages().list(
            userId="me",
            q=query,
            maxResults=min(max_results * 5, 50)  # Get more messages to increase chance of finding matches
        ).execute()
        
        messages = results.get("messages", [])
        if not messages:
            print(f"📧 No Gmail messages found matching '{name}'")
            return []
        
        print(f"📧 Found {len(messages)} Gmail message(s) to check")
        
        email_map = {}  # email -> most recent name
        
        # Check each message to extract email addresses
        for msg in messages[:max_results * 3]:  # Check more messages
            try:
                message = gmail_service.users().messages().get(
                    userId="me",
                    id=msg["id"],
                    format="metadata",
                    metadataHeaders=["From", "To", "Subject"]
                ).execute()
                
                headers = message.get("payload", {}).get("headers", [])
                from_header = None
                to_header = None
                
                for header in headers:
                    header_name = header.get("name", "").lower()
                    if header_name == "from":
                        from_header = header.get("value", "")
                    elif header_name == "to":
                        to_header = header.get("value", "")
                
                # Extract email from "Name <email@domain.com>" format
                def extract_email_and_name(header_value: str):
                    if not header_value:
                        return None, None
                    # Match "Name <email@domain.com>" or just "email@domain.com"
                    # Improved regex to handle various formats
                    match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', header_value)
                    if match:
                        email = match.group(1).strip()
                        # Extract name if present (before <email>)
                        name_match = re.match(r'^(.+?)\s*<[^>]+>', header_value)
                        if name_match:
                            display_name = name_match.group(1).strip('"\'')
                        else:
                            # Try to extract from "Name" email@domain.com format
                            name_match2 = re.match(r'^"([^"]+)"', header_value)
                            if name_match2:
                                display_name = name_match2.group(1).strip()
                            else:
                                display_name = email.split("@")[0]
                        return email, display_name
                    return None, None
                
                # Check From field (incoming emails)
                if from_header:
                    email, display_name = extract_email_and_name(from_header)
                    if email:
                        # Skip notification/bot emails
                        if is_notification_or_bot_email(email):
                            print(f"  ⏭️ Skipping notification/bot email: {display_name} <{email}>")
                            continue
                        
                        # Check if name matches (case-insensitive, partial match)
                        name_lower = name.lower()
                        display_lower = display_name.lower()
                        # Match if name is in display name or vice versa
                        if (name_lower in display_lower or 
                            any(part in display_lower for part in name_lower.split() if len(part) > 2)):
                            if email not in email_map:
                                email_map[email] = display_name
                                email_type = "personal" if is_personal_email(email) else "work/service"
                                print(f"  ✅ Found in From: {display_name} <{email}> ({email_type})")
                
                # Check To field (sent emails) - extract all recipients
                if to_header:
                    # To can have multiple recipients, split by comma
                    recipients = [r.strip() for r in to_header.split(",")]
                    for recipient in recipients:
                        email, display_name = extract_email_and_name(recipient)
                        if email:
                            # Skip notification/bot emails
                            if is_notification_or_bot_email(email):
                                continue
                            
                            # Check if name matches
                            name_lower = name.lower()
                            display_lower = display_name.lower()
                            if (name_lower in display_lower or 
                                any(part in display_lower for part in name_lower.split() if len(part) > 2)):
                                if email not in email_map:
                                    email_map[email] = display_name
                                    email_type = "personal" if is_personal_email(email) else "work/service"
                                    print(f"  ✅ Found in To: {display_name} <{email}> ({email_type})")
                                
            except Exception as e:
                print(f"⚠️ Error processing Gmail message {msg.get('id', 'unknown')}: {e}")
                continue
        
        # Convert to list format
        contacts = [{"name": display_name, "email": email} for email, display_name in email_map.items()]
        print(f"📧 Found {len(contacts)} email(s) from Gmail matching '{name}'")
        return contacts
        
    except Exception as e:
        print(f"⚠️ Error searching Gmail for '{name}': {e}")
        import traceback
        traceback.print_exc()
        return []


def find_best_contact_match(uid: str, name: str) -> Optional[str]:
    """
    Find the best matching contact email for a given name.
    First tries Google Contacts, then falls back to Gmail messages.
    Returns the first matching email, or None if no match found.
    
    Args:
        uid: User ID
        name: Name to search for
        
    Returns:
        Email address string, or None
    """
    if not uid:
        print(f"⚠️ Cannot lookup contact '{name}' - user ID is missing")
        return None
    
    if not name or not name.strip():
        print(f"⚠️ Cannot lookup contact - name is empty")
        return None
    
    name_clean = name.strip()
    print(f"🔍 Looking up contact '{name_clean}' for user {uid}")
    
    # First, try Google Contacts
    print(f"📇 Step 1: Searching Google Contacts for '{name_clean}'...")
    contacts = search_contacts_by_name(uid, name_clean, max_results=5)  # Get more results for better matching
    if contacts:
        # Sort contacts: personal emails first, then others
        personal_contacts = []
        other_contacts = []
        
        for contact in contacts:
            email = contact.get("email")
            if email and is_personal_email(email):
                personal_contacts.append(contact)
            else:
                other_contacts.append(contact)
        
        sorted_contacts = personal_contacts + other_contacts
        
        # Try to find the best match (exact name match first, then partial)
        name_lower = name_clean.lower()
        
        # First, try exact match (prefer personal emails)
        for contact in sorted_contacts:
            contact_name = contact.get("name", "").lower()
            if contact_name == name_lower:
                email = contact.get("email")
                if is_personal_email(email):
                    print(f"✅ Exact match found in contacts (personal): {contact.get('name')} -> {email}")
                    return email
                else:
                    print(f"⚠️ Found exact match but it's a service email: {contact.get('name')} -> {email}")
                    # Continue to look for personal emails
        
        # If no exact match, try partial match (prefer personal emails)
        for contact in sorted_contacts:
            contact_name = contact.get("name", "").lower()
            # Check if search name is in contact name or contact name words are in search name
            if (name_lower in contact_name or 
                any(word in name_lower for word in contact_name.split() if len(word) > 2)):
                email = contact.get("email")
                if email and is_personal_email(email):
                    print(f"✅ Partial match found in contacts (personal): {contact.get('name')} -> {email}")
                    return email
                elif email:
                    print(f"⚠️ Found partial match but it's a service email: {contact.get('name')} -> {email}")
                    # Continue to look for personal emails
        
        # If still no match, return first personal email if available
        if personal_contacts:
            email = personal_contacts[0].get("email")
            contact_name = personal_contacts[0].get("name")
            print(f"✅ Using first personal contact result: {contact_name} -> {email}")
            return email
        elif other_contacts:
            # Only service emails found - ask user instead
            print(f"⚠️ Only found service emails in contacts for '{name_clean}', will ask user for email")
            return None
    
    # Fallback: search Gmail messages
    print(f"📧 Step 2: Contact not found in Google Contacts, searching Gmail messages for '{name_clean}'...")
    gmail_contacts = search_gmail_by_name(uid, name_clean, max_results=10)
    if gmail_contacts:
        # Sort contacts: personal emails first, then others
        # This ensures we prioritize actual person emails over service emails
        personal_contacts = []
        other_contacts = []
        
        for contact in gmail_contacts:
            email = contact.get("email")
            if email and is_personal_email(email):
                personal_contacts.append(contact)
            else:
                other_contacts.append(contact)
        
        # Prioritize personal emails
        sorted_contacts = personal_contacts + other_contacts
        print(f"📧 Found {len(personal_contacts)} personal email(s) and {len(other_contacts)} other email(s)")
        
        # Similar matching logic for Gmail results
        name_lower = name_clean.lower()
        
        # Try exact match first (prioritizing personal emails)
        for contact in sorted_contacts:
            contact_name = contact.get("name", "").lower()
            if contact_name == name_lower:
                email = contact.get("email")
                if is_personal_email(email):
                    print(f"✅ Exact match found in Gmail (personal): {contact.get('name')} -> {email}")
                    return email
                else:
                    print(f"⚠️ Found exact match but it's a service email: {contact.get('name')} -> {email}")
                    # Don't return service emails - ask user instead
        
        # Try partial match (only return personal emails)
        for contact in sorted_contacts:
            contact_name = contact.get("name", "").lower()
            if (name_lower in contact_name or 
                any(word in name_lower for word in contact_name.split() if len(word) > 2)):
                email = contact.get("email")
                if email and is_personal_email(email):
                    print(f"✅ Partial match found in Gmail (personal): {contact.get('name')} -> {email}")
                    return email
                elif email:
                    print(f"⚠️ Found partial match but it's a service email: {contact.get('name')} -> {email}")
                    # Don't return service emails - ask user instead
        
        # Only return first result if it's a personal email
        if sorted_contacts:
            email = sorted_contacts[0].get("email")
            contact_name = sorted_contacts[0].get("name")
            if is_personal_email(email):
                print(f"✅ Using first Gmail result (personal): {contact_name} -> {email}")
                return email
            else:
                print(f"⚠️ Only found service emails for '{name_clean}', will ask user for email")
                return None
    
    print(f"❌ No email found for '{name_clean}' in contacts or Gmail")
    return None

