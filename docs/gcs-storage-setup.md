# Google Cloud Storage (GCS) Configuration Guide

This guide explains how to configure Google Cloud Storage (GCS) as the storage backend for your CodePush server.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. A GCP project with billing enabled
3. Google Cloud Storage API enabled

## Setup Steps

### 1. Create a GCS Bucket

```bash
# Using gcloud CLI
gsutil mb gs://your-codepush-bucket-name

# Or create via Google Cloud Console:
# https://console.cloud.google.com/storage
```

### 2. Set Bucket Permissions

Make your bucket publicly readable for download URLs:

```bash
gsutil iam ch allUsers:objectViewer gs://your-codepush-bucket-name
```

### 3. Create Service Account

1. Go to [Google Cloud Console IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. Enter a name and description
4. Grant the following roles:
   - `Storage Object Admin` (for full object management)
   - Or `Storage Object Creator` + `Storage Object Viewer` (for minimal permissions)

### 4. Generate Service Account Key

1. Click on your service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Download the key file

### 5. Configure Environment Variables

Set the following environment variables:

```bash
# Required: Set storage type to GCS
STORAGE_TYPE=gcs

# Required: Your GCP project ID
GCS_PROJECT_ID=your-project-id

# Required: Path to service account key file
GCS_KEY_FILENAME=/path/to/service-account-key.json

# Required: Your GCS bucket name
GCS_BUCKET_NAME=your-codepush-bucket-name

# Optional: Custom download URL (defaults to Google Cloud Storage public URL)
GCS_DOWNLOAD_URL=https://storage.googleapis.com/your-codepush-bucket-name
```

## Alternative Authentication Methods

### Using Default Application Credentials

If your server runs on Google Cloud (Compute Engine, GKE, etc.), you can use default application credentials:

1. Don't set `GCS_KEY_FILENAME`
2. Ensure your compute instance has the correct service account attached
3. The Storage API will automatically use the instance's service account

### Using Environment Variable for Key

Instead of a file, you can set the service account key as an environment variable:

```bash
# Set the entire JSON key as an environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Or use the JSON content directly
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

## Security Best Practices

1. **Least Privilege**: Only grant necessary permissions to your service account
2. **Key Rotation**: Regularly rotate your service account keys
3. **Private Keys**: Never commit service account keys to version control
4. **Bucket Security**: Consider using signed URLs for additional security
5. **Network Security**: Use VPC if running on Google Cloud

## Troubleshooting

### Common Issues

1. **Authentication Error**: Verify your service account key is valid and has correct permissions
2. **Bucket Not Found**: Ensure the bucket exists and your service account has access
3. **Permission Denied**: Check that your service account has `Storage Object Admin` role
4. **Network Issues**: Verify firewall rules allow HTTPS traffic to storage.googleapis.com

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug
```

## Cost Optimization

1. Use lifecycle policies to automatically delete old versions
2. Choose appropriate storage class (Standard, Nearline, Coldline)
3. Consider using regional buckets for better performance and lower costs
4. Monitor usage with Google Cloud Console

## Example Configuration

Here's a complete example configuration for GCS:

```bash
# .env file
STORAGE_TYPE=gcs
GCS_PROJECT_ID=my-codepush-project
GCS_KEY_FILENAME=/app/keys/service-account.json
GCS_BUCKET_NAME=my-codepush-storage
GCS_DOWNLOAD_URL=https://storage.googleapis.com/my-codepush-storage
```

## Docker Setup

When using Docker, mount your service account key file:

```yaml
# docker-compose.yml
version: '3.8'
services:
  codepush-server:
    image: your-codepush-image
    environment:
      - STORAGE_TYPE=gcs
      - GCS_PROJECT_ID=my-codepush-project
      - GCS_KEY_FILENAME=/app/keys/service-account.json
      - GCS_BUCKET_NAME=my-codepush-storage
    volumes:
      - ./service-account.json:/app/keys/service-account.json:ro
``` 