/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("clinical_notes");
  collection.listRule = "provider_id = @request.auth.id || user_id = @request.auth.id";
  collection.viewRule = "provider_id = @request.auth.id || user_id = @request.auth.id";
  collection.createRule = "provider_id = @request.auth.id";
  collection.updateRule = "provider_id = @request.auth.id";
  collection.deleteRule = "provider_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("clinical_notes");
  collection.listRule = "provider_id = @request.auth.id || user_id = @request.auth.id";
  collection.viewRule = "provider_id = @request.auth.id || user_id = @request.auth.id";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "provider_id = @request.auth.id";
  collection.deleteRule = "provider_id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})