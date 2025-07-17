package io.unitycatalog.server.service;

import com.linecorp.armeria.common.HttpResponse;
import com.linecorp.armeria.server.annotation.ExceptionHandler;
import com.linecorp.armeria.server.annotation.Post;
import io.unitycatalog.server.auth.annotation.AuthorizeExpression;
import io.unitycatalog.server.auth.annotation.AuthorizeKey;
import io.unitycatalog.server.exception.GlobalExceptionHandler;
import io.unitycatalog.server.model.GenerateTemporaryPathCredential;
import io.unitycatalog.server.model.PathOperation;
import io.unitycatalog.server.service.credential.CredentialContext;
import io.unitycatalog.server.service.credential.CloudCredentialVendor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Set;

import static io.unitycatalog.server.model.SecurableType.METASTORE;
import static io.unitycatalog.server.service.credential.CredentialContext.Privilege.SELECT;
import static io.unitycatalog.server.service.credential.CredentialContext.Privilege.UPDATE;

@ExceptionHandler(GlobalExceptionHandler.class)
public class TemporaryPathCredentialsService {
    private static final Logger LOGGER = LoggerFactory.getLogger(TemporaryPathCredentialsService.class);
    
    private final CloudCredentialVendor cloudCredentialVendor;

    public TemporaryPathCredentialsService(CloudCredentialVendor cloudCredentialVendor) {
        this.cloudCredentialVendor = cloudCredentialVendor;
    }

    @Post("")
    // Authorization approach:
    // 1. METASTORE OWNER always has access (admin users)
    // 2. For PATH_CREATE_TABLE operations, we defer authorization to allow table creation
    //    The actual permission check happens in TableService.createTable()
    //    This is necessary because Spark doesn't pass catalog/schema info when requesting path credentials
    // 3. For other operations (PATH_READ, PATH_READ_WRITE), require METASTORE OWNER
    @AuthorizeExpression("""
        #authorize(#principal, #metastore, OWNER) ||
        (#generateTemporaryPathCredential.operation.name() == 'PATH_CREATE_TABLE')
    """)
    @AuthorizeKey(METASTORE)
    public HttpResponse generateTemporaryPathCredential(
        GenerateTemporaryPathCredential generateTemporaryPathCredential) {
        
        LOGGER.debug("Generating temporary credentials for path: {} with operation: {}", 
            generateTemporaryPathCredential.getUrl(), 
            generateTemporaryPathCredential.getOperation());
            
        return HttpResponse.ofJson(
                cloudCredentialVendor.vendCredential(
                        generateTemporaryPathCredential.getUrl(),
                        pathOperationToPrivileges(generateTemporaryPathCredential.getOperation())));
    }

    private Set<CredentialContext.Privilege> pathOperationToPrivileges(PathOperation pathOperation) {
        return switch (pathOperation) {
            case PATH_READ -> Set.of(SELECT);
            case PATH_READ_WRITE, PATH_CREATE_TABLE -> Set.of(SELECT, UPDATE);
            case UNKNOWN_PATH_OPERATION -> Collections.emptySet();
        };
    }
}