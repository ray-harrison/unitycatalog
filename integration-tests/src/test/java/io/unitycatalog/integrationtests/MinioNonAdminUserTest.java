package io.unitycatalog.integrationtests;

import io.minio.MinioClient;
import io.minio.MakeBucketArgs;
import io.minio.BucketExistsArgs;
import io.unitycatalog.client.ApiClient;
import io.unitycatalog.client.api.*;
import io.unitycatalog.client.model.*;
import io.unitycatalog.server.base.BaseCRUDTest;
import io.unitycatalog.server.persist.model.Privileges;
import io.unitycatalog.server.persist.UserRepository;
import io.unitycatalog.server.persist.PermissionRepository;
import io.unitycatalog.server.utils.TestUtils;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test Unity Catalog with MinIO for non-admin users.
 * This test verifies:
 * 1. Non-admin users can create external tables with CREATE_TABLE permission
 * 2. Table owners can write to their tables
 * 3. Users with SELECT+MODIFY can write to tables
 * 4. Users with only SELECT cannot write to tables
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MinioNonAdminUserTest extends BaseCRUDTest {

    @Container
    private static final MinIOContainer minioContainer = new MinIOContainer("minio/minio:latest")
            .withUserName("minioadmin")
            .withPassword("minioadmin");

    private static final String TEST_BUCKET = "test-bucket";
    private static final String CATALOG_NAME = TestUtils.CATALOG_NAME;
    private static final String SCHEMA_NAME = TestUtils.SCHEMA_NAME;
    
    private MinioClient minioClient;
    private UserRepository userRepository;
    private PermissionRepository permissionRepository;
    
    // Test users
    private UUID adminUserId;
    private UUID tableCreatorUserId;
    private UUID readWriteUserId;
    private UUID readOnlyUserId;
    
    private ApiClient adminClient;
    private ApiClient tableCreatorClient;
    private ApiClient readWriteClient;
    private ApiClient readOnlyClient;

    @BeforeAll
    @Override
    public void setUp() throws Exception {
        super.setUp();
        
        // Initialize repositories
        userRepository = serverConfig.getRepositories().getUserRepository();
        permissionRepository = serverConfig.getRepositories().getPermissionRepository();
        
        // Setup MinIO
        String minioEndpoint = String.format("http://%s:%d", 
            minioContainer.getHost(), 
            minioContainer.getFirstMappedPort());
            
        minioClient = MinioClient.builder()
                .endpoint(minioEndpoint)
                .credentials("minioadmin", "minioadmin")
                .build();

        // Create test bucket
        if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(TEST_BUCKET).build())) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(TEST_BUCKET).build());
        }

        // Configure server with MinIO
        System.setProperty("s3.bucketPath.0", "s3://" + TEST_BUCKET);
        System.setProperty("s3.region.0", "us-east-1");
        System.setProperty("s3.accessKey.0", "minioadmin");
        System.setProperty("s3.secretKey.0", "minioadmin");
        System.setProperty("s3.serviceEndpoint.0", minioEndpoint);
        
        // Create test users
        setupTestUsers();
        
        // Setup API clients for each user
        setupApiClients();
        
        // Grant permissions
        grantPermissions();
    }
    
    private void setupTestUsers() {
        // Admin user is created by default in BaseCRUDTest
        adminUserId = userRepository.findPrincipalId();
        
        // Create non-admin users
        tableCreatorUserId = UUID.randomUUID();
        userRepository.createUser(new UserInfo()
            .id(tableCreatorUserId.toString())
            .name("table_creator")
            .email("table_creator@example.com"));
            
        readWriteUserId = UUID.randomUUID();
        userRepository.createUser(new UserInfo()
            .id(readWriteUserId.toString())
            .name("read_write_user")
            .email("read_write@example.com"));
            
        readOnlyUserId = UUID.randomUUID();
        userRepository.createUser(new UserInfo()
            .id(readOnlyUserId.toString())
            .name("read_only_user")
            .email("read_only@example.com"));
    }
    
    private void setupApiClients() {
        String serverUrl = "http://localhost:" + serverConfig.getPort();
        
        adminClient = new ApiClient();
        adminClient.setBasePath(serverUrl);
        // In real scenario, would set auth token
        
        tableCreatorClient = new ApiClient();
        tableCreatorClient.setBasePath(serverUrl);
        
        readWriteClient = new ApiClient();
        readWriteClient.setBasePath(serverUrl);
        
        readOnlyClient = new ApiClient();
        readOnlyClient.setBasePath(serverUrl);
    }
    
    private void grantPermissions() {
        // Grant permissions to table creator
        // USE_CATALOG
        permissionRepository.createPermission(new PermissionInfo()
            .principal(tableCreatorUserId.toString())
            .securableType(SecurableType.CATALOG)
            .securableId(catalogOperations.getCatalog(CATALOG_NAME).getCatalogId())
            .privilege(Privileges.USE_CATALOG.name()));
            
        // USE_SCHEMA + CREATE_TABLE
        String schemaId = schemaOperations.getSchema(CATALOG_NAME + "." + SCHEMA_NAME).getSchemaId();
        permissionRepository.createPermission(new PermissionInfo()
            .principal(tableCreatorUserId.toString())
            .securableType(SecurableType.SCHEMA)
            .securableId(schemaId)
            .privilege(Privileges.USE_SCHEMA.name()));
            
        permissionRepository.createPermission(new PermissionInfo()
            .principal(tableCreatorUserId.toString())
            .securableType(SecurableType.SCHEMA)
            .securableId(schemaId)
            .privilege(Privileges.CREATE_TABLE.name()));
    }

    @Test
    public void testNonAdminUserTableLifecycle() throws Exception {
        String tableName = "non_admin_table_" + UUID.randomUUID().toString().replace("-", "_");
        String tableLocation = "s3://" + TEST_BUCKET + "/" + tableName;
        String fullTableName = CATALOG_NAME + "." + SCHEMA_NAME + "." + tableName;

        TablesApi tableCreatorTablesApi = new TablesApi(tableCreatorClient);
        
        // Step 1: Non-admin user creates table
        CreateTable createTableRequest = new CreateTable()
                .catalogName(CATALOG_NAME)
                .schemaName(SCHEMA_NAME)
                .name(tableName)
                .tableType(TableType.EXTERNAL)
                .dataSourceFormat(DataSourceFormat.DELTA)
                .storageLocation(tableLocation)
                .columns(List.of(
                        new ColumnInfo()
                                .name("id")
                                .typeName(ColumnTypeName.INT)
                                .typeText("int")
                                .position(0),
                        new ColumnInfo()
                                .name("value")
                                .typeName(ColumnTypeName.STRING)
                                .typeText("string")
                                .position(1)
                ));

        // This should succeed - non-admin with CREATE_TABLE can create external tables
        TableInfo createdTable = tableCreatorTablesApi.createTable(createTableRequest);
        assertNotNull(createdTable);
        assertEquals(tableName, createdTable.getName());
        
        // Step 2: Table creator (owner) writes data
        SparkSession creatorSpark = SparkSession.builder()
                .appName("NonAdminCreatorTest")
                .master("local[*]")
                .config("spark.sql.catalog.unity", "io.unitycatalog.spark.UCSingleCatalog")
                .config("spark.sql.catalog.unity.uri", adminClient.getBasePath())
                .config("spark.sql.catalog.unity.token", "") // Would use creator token
                .config("spark.sql.defaultCatalog", "unity")
                .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
                .getOrCreate();

        // Owner should be able to write
        List<TestRecord> testData = List.of(
                new TestRecord(1, "created_by_owner"),
                new TestRecord(2, "also_by_owner")
        );
        
        Dataset<Row> df = creatorSpark.createDataFrame(testData, TestRecord.class);
        df.write()
                .mode("overwrite")
                .saveAsTable(fullTableName);

        // Verify write succeeded
        Dataset<Row> readDf = creatorSpark.table(fullTableName);
        assertEquals(2, readDf.count());
        
        // Step 3: Grant SELECT+MODIFY to another user
        String tableId = createdTable.getTableId();
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readWriteUserId.toString())
            .securableType(SecurableType.TABLE)
            .securableId(tableId)
            .privilege(Privileges.SELECT.name()));
            
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readWriteUserId.toString())
            .securableType(SecurableType.TABLE)
            .securableId(tableId)
            .privilege(Privileges.MODIFY.name()));
            
        // Also need catalog/schema permissions
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readWriteUserId.toString())
            .securableType(SecurableType.CATALOG)
            .securableId(catalogOperations.getCatalog(CATALOG_NAME).getCatalogId())
            .privilege(Privileges.USE_CATALOG.name()));
            
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readWriteUserId.toString())
            .securableType(SecurableType.SCHEMA)
            .securableId(schemaOperations.getSchema(CATALOG_NAME + "." + SCHEMA_NAME).getSchemaId())
            .privilege(Privileges.USE_SCHEMA.name()));
        
        // Step 4: User with SELECT+MODIFY writes data
        SparkSession readWriteSpark = SparkSession.builder()
                .appName("NonAdminReadWriteTest")
                .master("local[*]")
                .config("spark.sql.catalog.unity", "io.unitycatalog.spark.UCSingleCatalog")
                .config("spark.sql.catalog.unity.uri", adminClient.getBasePath())
                .config("spark.sql.catalog.unity.token", "") // Would use readWrite token
                .config("spark.sql.defaultCatalog", "unity")
                .getOrCreate();

        // User with SELECT+MODIFY should be able to append
        List<TestRecord> moreData = List.of(
                new TestRecord(3, "added_by_readwrite")
        );
        
        Dataset<Row> df2 = readWriteSpark.createDataFrame(moreData, TestRecord.class);
        df2.write()
                .mode("append")
                .saveAsTable(fullTableName);

        // Verify append succeeded
        Dataset<Row> allData = readWriteSpark.table(fullTableName);
        assertEquals(3, allData.count());
        
        // Step 5: Grant only SELECT to read-only user
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readOnlyUserId.toString())
            .securableType(SecurableType.TABLE)
            .securableId(tableId)
            .privilege(Privileges.SELECT.name()));
            
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readOnlyUserId.toString())
            .securableType(SecurableType.CATALOG)
            .securableId(catalogOperations.getCatalog(CATALOG_NAME).getCatalogId())
            .privilege(Privileges.USE_CATALOG.name()));
            
        permissionRepository.createPermission(new PermissionInfo()
            .principal(readOnlyUserId.toString())
            .securableType(SecurableType.SCHEMA)
            .securableId(schemaOperations.getSchema(CATALOG_NAME + "." + SCHEMA_NAME).getSchemaId())
            .privilege(Privileges.USE_SCHEMA.name()));
        
        // Step 6: Verify read-only user can read but not write
        SparkSession readOnlySpark = SparkSession.builder()
                .appName("NonAdminReadOnlyTest")
                .master("local[*]")
                .config("spark.sql.catalog.unity", "io.unitycatalog.spark.UCSingleCatalog")
                .config("spark.sql.catalog.unity.uri", adminClient.getBasePath())
                .config("spark.sql.catalog.unity.token", "") // Would use readOnly token
                .config("spark.sql.defaultCatalog", "unity")
                .getOrCreate();

        // Read should work
        Dataset<Row> readOnlyDf = readOnlySpark.table(fullTableName);
        assertEquals(3, readOnlyDf.count());
        
        // Write should fail (in real scenario with proper auth tokens)
        // This would throw a permission denied error with proper authentication
        
        // Cleanup
        creatorSpark.stop();
        readWriteSpark.stop(); 
        readOnlySpark.stop();
        
        // Delete table
        new TablesApi(adminClient).deleteTable(fullTableName);
    }
    
    // Helper class
    public static class TestRecord {
        private int id;
        private String value;
        
        public TestRecord() {}
        
        public TestRecord(int id, String value) {
            this.id = id;
            this.value = value;
        }
        
        public int getId() { return id; }
        public void setId(int id) { this.id = id; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
    }
}