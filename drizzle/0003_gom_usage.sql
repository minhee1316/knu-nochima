CREATE TABLE gom_usage (
  scope TEXT NOT NULL,
  window INTEGER NOT NULL,
  calls INTEGER NOT NULL,
  PRIMARY KEY (scope, window)
);
