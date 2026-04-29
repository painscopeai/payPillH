/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("contract_performance");
  collection.listRule = "insurance_id = @request.auth.id";
  collection.viewRule = "insurance_id = @request.auth.id";
  collection.createRule = "insurance_id = @request.auth.id";
  collection.updateRule = "insurance_id = @request.auth.id";
  collection.deleteRule = "insurance_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("contract_performance");
  collection.createRule = "insurance_id = @request.auth.id";
  collection.listRule = "insurance_id = @request.auth.id";
  collection.viewRule = "insurance_id = @request.auth.id";
  collection.updateRule = "insurance_id = @request.auth.id";
  collection.deleteRule = "insurance_id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})