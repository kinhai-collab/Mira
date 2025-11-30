#!/bin/bash
# Deploy MIRA WebSocket service to AWS Fargate (ECS)
# This script creates ECS cluster, task definition, service, and ALB

set -e

REGION="us-east-2"
CLUSTER_NAME="mira-websocket-cluster"
SERVICE_NAME="mira-websocket-service"
TASK_FAMILY="mira-websocket"
IMAGE_URI="058057616533.dkr.ecr.us-east-2.amazonaws.com/mira-websocket:latest"
CONTAINER_NAME="mira-websocket"
CONTAINER_PORT=8080

echo "🚀 Deploying MIRA WebSocket to AWS Fargate..."

# Step 1: Create ECS Cluster
echo "📦 Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --region $REGION \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    --query 'cluster.clusterName' \
    --output text || echo "Cluster may already exist"

# Step 2: Create Task Execution Role (if not exists)
echo "🔐 Creating task execution role..."
EXEC_ROLE_ARN=$(aws iam create-role \
    --role-name ecsTaskExecutionRole-mira \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }' \
    --query 'Role.Arn' \
    --output text 2>/dev/null || \
    aws iam get-role --role-name ecsTaskExecutionRole-mira --query 'Role.Arn' --output text)

# Attach policies to execution role
aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole-mira \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole-mira \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Step 3: Create Task Role (for DynamoDB/S3 access)
echo "🔐 Creating task role..."
TASK_ROLE_ARN=$(aws iam create-role \
    --role-name ecsTaskRole-mira \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }' \
    --query 'Role.Arn' \
    --output text 2>/dev/null || \
    aws iam get-role --role-name ecsTaskRole-mira --query 'Role.Arn' --output text)

# Attach DynamoDB and S3 policies
aws iam attach-role-policy \
    --role-name ecsTaskRole-mira \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
    --role-name ecsTaskRole-mira \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Step 4: Register Task Definition
echo "📝 Registering task definition..."
aws ecs register-task-definition \
    --family $TASK_FAMILY \
    --network-mode awsvpc \
    --requires-compatibilities FARGATE \
    --cpu 1024 \
    --memory 2048 \
    --execution-role-arn $EXEC_ROLE_ARN \
    --task-role-arn $TASK_ROLE_ARN \
    --container-definitions "[{
        \"name\": \"$CONTAINER_NAME\",
        \"image\": \"$IMAGE_URI\",
        \"portMappings\": [{
            \"containerPort\": $CONTAINER_PORT,
            \"protocol\": \"tcp\"
        }],
        \"environment\": [
            {\"name\": \"SUPABASE_URL\", \"value\": \"https://oxozhsomntvuyrurfzre.supabase.co/\"},
            {\"name\": \"SUPABASE_KEY\", \"value\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94b3poc29tbnR2dXlydXJmenJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NjczNDAsImV4cCI6MjA3NjA0MzM0MH0.kXO2FS3sTV3jpT1A8dzr0sr8Md2VM80dbG2uzOnG6_c\"},
            {\"name\": \"SUPABASE_SERVICE_ROLE_KEY\", \"value\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94b3poc29tbnR2dXlydXJmenJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDQ2NzM0MCwiZXhwIjoyMDc2MDQzMzQwfQ.xDiiiOl2DJpBnVDDMPOMSo_hs1dI_JKbDDViWD5XufU\"},
            {\"name\": \"ELEVENLABS_API_KEY\", \"value\": \"sk_51ea0fad38f8a7c13f3572f7885bce862f06285ce62818a5\"},
            {\"name\": \"ELEVENLABS_VOICE_ID\", \"value\": \"jqcCZkN6Knx8BJ5TBdYR\"},
            {\"name\": \"OPENAI_API_KEY\", \"value\": \"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\"},
            {\"name\": \"FRONTEND_URL\", \"value\": \"https://main.dd480r9y8ima.amplifyapp.com\"},
            {\"name\": \"USE_DYNAMODB\", \"value\": \"true\"},
            {\"name\": \"STAGE\", \"value\": \"dev\"},
            {\"name\": \"TRANSCRIPTS_TABLE\", \"value\": \"mira-transcripts-dev\"},
            {\"name\": \"CACHE_TABLE\", \"value\": \"mira-cache-dev\"},
            {\"name\": \"SESSIONS_TABLE\", \"value\": \"mira-sessions-dev\"},
            {\"name\": \"S3_BUCKET\", \"value\": \"mira-data-dev-058057616533\"}
        ],
        \"logConfiguration\": {
            \"logDriver\": \"awslogs\",
            \"options\": {
                \"awslogs-group\": \"/ecs/$TASK_FAMILY\",
                \"awslogs-region\": \"$REGION\",
                \"awslogs-stream-prefix\": \"ecs\"
            }
        },
        \"healthCheck\": {
            \"command\": [\"CMD-SHELL\", \"curl -f http://localhost:$CONTAINER_PORT/health || exit 1\"],
            \"interval\": 30,
            \"timeout\": 5,
            \"retries\": 3,
            \"startPeriod\": 60
        }
    }]" \
    --region $REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text

echo "✅ Task definition registered!"

echo ""
echo "📋 Next steps (manual via AWS Console):"
echo "1. Create VPC and subnets (or use default)"
echo "2. Create Security Group (allow port 8080)"
echo "3. Create Application Load Balancer (for WebSocket)"
echo "4. Create ECS Service"
echo ""
echo "Or run the full deployment script with VPC setup..."

