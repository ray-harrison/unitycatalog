#!/bin/bash

# Script to test Unity Catalog with MinIO
# This script:
# 1. Starts MinIO using docker-compose
# 2. Configures and starts Unity Catalog server
# 3. Runs Spark commands to test the integration

set -e

echo "Starting MinIO..."
docker-compose up -d

echo "Waiting for MinIO to be ready..."
sleep 10

echo "MinIO Console available at: http://localhost:9001"
echo "MinIO API available at: http://localhost:9000"

# Create server properties for MinIO
cat > /tmp/minio-server.properties << EOF
# MinIO S3 Configuration
s3.bucketPath.0=s3://test-bucket
s3.region.0=us-east-1
s3.accessKey.0=minioadmin
s3.secretKey.0=minioadmin
s3.serviceEndpoint.0=http://localhost:9000

# Server configuration
server.port=8080
EOF

echo "Starting Unity Catalog server with MinIO configuration..."
cd ../../
bin/start-uc-server --properties /tmp/minio-server.properties &
UC_PID=$!

echo "Waiting for Unity Catalog server to start..."
sleep 10

echo "Creating test script for Spark..."
cat > /tmp/test-minio-spark.scala << 'EOF'
// Test Unity Catalog with MinIO
println("Testing Unity Catalog with MinIO...")

// Create a test table
spark.sql("""
  CREATE TABLE IF NOT EXISTS unity.default.minio_test (
    id INT,
    name STRING
  ) USING parquet
  LOCATION 's3://test-bucket/minio_test'
""")

// Write some data
val df = Seq(
  (1, "Alice"),
  (2, "Bob"),
  (3, "Charlie")
).toDF("id", "name")

df.write.mode("overwrite").saveAsTable("unity.default.minio_test")

// Read the data back
val result = spark.table("unity.default.minio_test")
result.show()

// Verify count
val count = result.count()
println(s"Total records: $count")
assert(count == 3, "Expected 3 records")

println("MinIO integration test PASSED!")

// Cleanup
spark.sql("DROP TABLE IF EXISTS unity.default.minio_test")
EOF

echo "Running Spark test..."
spark-shell \
  --master "local[*]" \
  --packages "io.delta:delta-spark_2.13:4.0.0,io.unitycatalog:unitycatalog-spark_2.13:0.3.0" \
  --conf "spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension" \
  --conf "spark.sql.catalog.unity=io.unitycatalog.spark.UCSingleCatalog" \
  --conf "spark.sql.catalog.unity.uri=http://localhost:8080" \
  --conf "spark.sql.catalog.unity.token=" \
  --conf "spark.sql.defaultCatalog=unity" \
  < /tmp/test-minio-spark.scala

echo "Cleaning up..."
kill $UC_PID
docker-compose down

echo "Test completed!"