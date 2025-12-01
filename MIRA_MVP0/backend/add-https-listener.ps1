# Add HTTPS Listener to ALB
# Run this once certificate status is "ISSUED"

$REGION = "us-east-2"
$ALB_ARN = "arn:aws:elasticloadbalancing:us-east-2:058057616533:loadbalancer/app/mira-websocket-alb/14797d014cd94986"
$TARGET_GROUP_ARN = "arn:aws:elasticloadbalancing:us-east-2:058057616533:targetgroup/mira-websocket-tg/36d972591d60ee85"
$CERT_ARN = "arn:aws:acm:us-east-2:058057616533:certificate/d1decd69-8ff6-4606-879e-75374462b30e"

Write-Host "=== Adding HTTPS Listener to ALB ===" -ForegroundColor Cyan
Write-Host ""

# Check certificate status first
Write-Host "Checking certificate status..." -ForegroundColor Yellow
$certStatus = aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status' --output text

if ($certStatus -ne "ISSUED") {
    Write-Host "❌ Certificate is not yet issued. Current status: $certStatus" -ForegroundColor Red
    Write-Host "Please wait for certificate validation to complete." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Certificate is ISSUED" -ForegroundColor Green
Write-Host ""

# Check if HTTPS listener already exists
Write-Host "Checking for existing HTTPS listener..." -ForegroundColor Yellow
$existingListener = aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region $REGION --query "Listeners[?Port==\`443\`].ListenerArn" --output text

if ($existingListener) {
    Write-Host "✅ HTTPS listener already exists: $existingListener" -ForegroundColor Green
    exit 0
}

# Create HTTPS listener
Write-Host "Creating HTTPS listener on port 443..." -ForegroundColor Yellow
$listenerOutput = aws elbv2 create-listener `
    --load-balancer-arn $ALB_ARN `
    --protocol HTTPS `
    --port 443 `
    --certificates CertificateArn=$CERT_ARN `
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN `
    --region $REGION `
    --output json | ConvertFrom-Json

$listenerArn = $listenerOutput.Listeners[0].ListenerArn
Write-Host "✅ HTTPS listener created!" -ForegroundColor Green
Write-Host "Listener ARN: $listenerArn" -ForegroundColor Cyan
Write-Host ""

# Verify listeners
Write-Host "Current listeners:" -ForegroundColor Yellow
aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region $REGION --query 'Listeners[*].{Port:Port,Protocol:Protocol}' --output table

Write-Host ""
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your WebSocket endpoint:" -ForegroundColor Cyan
Write-Host "wss://mira-websocket-alb-1106182722.us-east-2.elb.amazonaws.com/api/ws/voice-stt" -ForegroundColor Green
Write-Host ""
Write-Host "Update your frontend environment variable:" -ForegroundColor Yellow
Write-Host "NEXT_PUBLIC_WS_URL=wss://mira-websocket-alb-1106182722.us-east-2.elb.amazonaws.com/api/ws/voice-stt" -ForegroundColor Cyan

