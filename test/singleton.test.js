const cds = require("@sap/cds");

// Mock remote services so mashup.js doesn't require them to be running
cds.env.requires.OrdersService.credentials = { url: "http://localhost:4006/orders" };

const { GET, expect, axios } = cds.test(".");
axios.defaults.auth = { username: "alice", password: "admin" };

describe("AuthorizationRestrictions singleton", () => {
  it("is accessible via OData and returns expected output", async () => {
    const { status, data } = await GET`/admin/AuthorizationRestrictions`;
    expect(status).to.equal(200);
    expect(data).to.containSubset({ ID: "SINGLETON", isDeleteForbidden: expect.any(Boolean), isCopyForbidden: expect.any(Boolean), isCreateForbidden: expect.any(Boolean) });
  });
});
