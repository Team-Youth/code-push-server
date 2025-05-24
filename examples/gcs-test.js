#!/usr/bin/env node

/**
 * GCS Storage Test Example
 * 
 * This script demonstrates how to test GCS storage functionality
 * for the CodePush server.
 */

const fs = require('fs');
const path = require('path');

// 환경변수가 설정되지 않은 경우에만 기본값 설정
if (!process.env.STORAGE_TYPE) {
    process.env.STORAGE_TYPE = 'gcs';
}
if (!process.env.GCS_PROJECT_ID) {
    process.env.GCS_PROJECT_ID = 'your-project-id';
}
if (!process.env.GCS_BUCKET_NAME) {
    process.env.GCS_BUCKET_NAME = 'your-bucket-name';
}
if (!process.env.GCS_KEY_FILENAME) {
    process.env.GCS_KEY_FILENAME = '/path/to/service-account-key.json';
}

// Import the storage module
const { uploadFileToStorage } = require('../bin/core/utils/storage');
const { logger } = require('kv-logger');

async function testGCSUpload() {
    console.log('=== GCS Storage Test ===');
    console.log('Environment:');
    console.log(`- STORAGE_TYPE: ${process.env.STORAGE_TYPE}`);
    console.log(`- GCS_PROJECT_ID: ${process.env.GCS_PROJECT_ID}`);
    console.log(`- GCS_BUCKET_NAME: ${process.env.GCS_BUCKET_NAME}`);
    console.log(`- GCS_KEY_FILENAME: ${process.env.GCS_KEY_FILENAME}`);
    console.log('');

    // Create a test file
    const testFile = path.join(__dirname, 'test-file.txt');
    const testContent = `Test file for GCS upload - ${new Date().toISOString()}`;
    
    try {
        // Write test file
        fs.writeFileSync(testFile, testContent);
        console.log(`✓ Created test file: ${testFile}`);

        // Test upload
        const key = `test-uploads/test-${Date.now()}.txt`;
        console.log(`📤 Uploading file with key: ${key}`);
        
        await uploadFileToStorage(key, testFile, logger);
        console.log('✅ Upload successful!');
        
        // Clean up
        fs.unlinkSync(testFile);
        console.log('🧹 Cleaned up test file');
        
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        
        // Common error messages and solutions
        if (error.message.includes('projectId')) {
            console.log('\n💡 Solution: Set GCS_PROJECT_ID environment variable');
        }
        if (error.message.includes('bucketName')) {
            console.log('\n💡 Solution: Set GCS_BUCKET_NAME environment variable');
        }
        if (error.message.includes('authentication') || error.message.includes('credentials')) {
            console.log('\n💡 Solution: Check GCS_KEY_FILENAME path and service account permissions');
        }
        
        // Clean up test file if it exists
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }
}

// Check if this script is run directly
if (require.main === module) {
    console.log('GCS Storage Test');
    console.log('================');
    console.log('Before running this test, make sure to:');
    console.log('1. Set your GCP project ID in GCS_PROJECT_ID');
    console.log('2. Set your bucket name in GCS_BUCKET_NAME');
    console.log('3. Set path to service account key in GCS_KEY_FILENAME');
    console.log('4. Ensure the bucket exists and is accessible');
    console.log('');
    
    // Check if required environment variables are set properly
    const requiredVars = ['GCS_PROJECT_ID', 'GCS_BUCKET_NAME'];
    const missingVars = requiredVars.filter(varName => 
        !process.env[varName] || process.env[varName] === 'your-project-id' || process.env[varName] === 'your-bucket-name'
    );
    
    if (missingVars.length > 0) {
        console.log('⚠️  Please set the following environment variables:');
        missingVars.forEach(varName => {
            console.log(`   ${varName}=${process.env[varName] || 'NOT_SET'}`);
        });
        console.log('');
        console.log('Example:');
        console.log('   GCS_PROJECT_ID=my-project npm run test:gcs');
        process.exit(1);
    }
    
    testGCSUpload().then(() => {
        console.log('\n🎉 Test completed');
    }).catch(error => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testGCSUpload }; 