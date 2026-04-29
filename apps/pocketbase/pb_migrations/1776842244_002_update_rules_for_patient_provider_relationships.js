/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patient_provider_relationships");
  collection.listRule = "patient_id = @request.auth.id || provider_id = @request.auth.id";
  collection.viewRule = "patient_id = @request.auth.id || provider_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("patient_provider_relationships");
  collection.listRule = "patient_id = @request.auth.id || provider_id = @request.auth.id";
  collection.viewRule = "patient_id = @request.auth.id || provider_id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})