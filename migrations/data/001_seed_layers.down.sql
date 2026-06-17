-- Data migration 001: Rollback seed layers

DELETE FROM layers WHERE id IN ('buildings', 'complex', 'zones', 'roads', 'poi', 'territory');