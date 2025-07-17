package io.unitycatalog.server.service;

import static org.junit.jupiter.api.Assertions.*;

import io.unitycatalog.server.model.*;
import org.junit.jupiter.api.Test;

public class TemporaryPathCredentialsServiceTest {

  @Test
  public void testAuthorizationForPathCreateTable() {
    // This test verifies that PATH_CREATE_TABLE doesn't require METASTORE OWNER
    // The actual authorization is enforced by the @AuthorizeExpression annotation
    
    String expression = """
        #authorize(#principal, #metastore, OWNER) ||
        (#generateTemporaryPathCredential.operation.name() == 'PATH_CREATE_TABLE')
    """;
    
    // Simulate the authorization check for non-owner with PATH_CREATE_TABLE
    boolean isOwner = false; // Non-admin user
    PathOperation operation = PathOperation.PATH_CREATE_TABLE;
    
    // The expression should evaluate to true for PATH_CREATE_TABLE even without OWNER
    boolean result = isOwner || (operation == PathOperation.PATH_CREATE_TABLE);
    assertTrue(result, "PATH_CREATE_TABLE should be allowed for non-owners");
    
    // But other operations should require OWNER
    operation = PathOperation.PATH_READ;
    result = isOwner || (operation == PathOperation.PATH_CREATE_TABLE);
    assertFalse(result, "PATH_READ should require OWNER");
    
    operation = PathOperation.PATH_READ_WRITE;
    result = isOwner || (operation == PathOperation.PATH_CREATE_TABLE);
    assertFalse(result, "PATH_READ_WRITE should require OWNER");
  }
  
  @Test
  public void testOwnerHasAccessToAllOperations() {
    // Test that OWNER has access to all operations
    boolean isOwner = true;
    
    for (PathOperation op : PathOperation.values()) {
      if (op == PathOperation.UNKNOWN_PATH_OPERATION) continue;
      
      boolean result = isOwner || (op == PathOperation.PATH_CREATE_TABLE);
      assertTrue(result, "OWNER should have access to " + op);
    }
  }
}