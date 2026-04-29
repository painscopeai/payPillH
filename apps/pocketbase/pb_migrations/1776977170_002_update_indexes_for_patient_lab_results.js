/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patient_lab_results");
  collection.indexes.push("CREATE INDEX idx_patient_lab_results_userId ON patient_lab_results (userId)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("patient_lab_results");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_patient_lab_results_userId"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})