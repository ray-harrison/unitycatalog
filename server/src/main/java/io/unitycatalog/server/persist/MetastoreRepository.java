package io.unitycatalog.server.persist;

import io.unitycatalog.server.exception.BaseException;
import io.unitycatalog.server.exception.ErrorCode;
import io.unitycatalog.server.model.GetMetastoreSummaryResponse;
import io.unitycatalog.server.persist.dao.MetastoreDAO;
import io.unitycatalog.server.persist.utils.TransactionManager;
import java.util.UUID;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MetastoreRepository {
  private static final Logger LOGGER = LoggerFactory.getLogger(MetastoreRepository.class);
  private final SessionFactory sessionFactory;

  public MetastoreRepository(Repositories repositories, SessionFactory sessionFactory) {
    this.sessionFactory = sessionFactory;
  }

  public GetMetastoreSummaryResponse getMetastoreSummary() {
    return TransactionManager.executeWithTransaction(
        sessionFactory,
        session -> {
          MetastoreDAO metastoreDAO = getMetastoreDAO(session);
          if (metastoreDAO == null) {
            throw new BaseException(
                ErrorCode.NOT_FOUND,
                "No metastore found. Please check if the server is initialized properly.");
          }
          return metastoreDAO.toGetMetastoreSummaryResponse();
        },
        "Failed to get metastore summary",
        /* readOnly = */ true);
  }

  public UUID getMetastoreId() {
    return UUID.fromString(getMetastoreSummary().getMetastoreId());
  }

  public MetastoreDAO getMetastoreDAO(Session session) {
    Query<MetastoreDAO> query = session.createQuery("FROM MetastoreDAO", MetastoreDAO.class);
    query.setMaxResults(1);
    return query.uniqueResult();
  }

  public MetastoreDAO initMetastoreIfNeeded() {
    return TransactionManager.executeWithTransaction(
        sessionFactory,
        session -> {
          MetastoreDAO metastoreDAO = getMetastoreDAO(session);
          if (metastoreDAO == null) {
            LOGGER.info("No metastore found, initializing a metastore for the server...");
            metastoreDAO = new MetastoreDAO();
            metastoreDAO.setId(UUID.randomUUID());
            session.persist(metastoreDAO);
          }
          LOGGER.info("Server initialized with metastore id: {}", metastoreDAO.getId());
          return metastoreDAO;
        },
        "Failed to initialize metastore",
        /* readOnly = */ false);
  }
}
