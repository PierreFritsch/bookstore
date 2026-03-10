const cds = require("@sap/cds");

// Add routes to UIs from imported packages
if (!cds.env.production)
  cds.once("bootstrap", (app) => {
    app.serve("/bookshop").from("@capire/bookshop", "app/vue");
    app.serve("/orders").from("@capire/orders", "app/orders");
  });

// Mashing up bookshop services with required services...
cds.once("served", async () => {
  const CatalogService = await cds.connect.to("CatalogService");
  const OrdersService = await cds.connect.to("OrdersService");
  const db = await cds.connect.to("db");

  // reflect entity definitions used below...
  const { Books } = cds.entities("sap.capire.bookshop");

  //
  // Create an order with the OrdersService when CatalogService signals a new order
  //
  CatalogService.before("submitOrder", async (req) => {
    const { book, quantity, buyer = req.user.id } = req.data;
    const { title, price, currency } = await db.read(Books, book, (b) => {
      (b.title, b.price, b.currency((c) => c.code));
    });
    await OrdersService.create("OrdersNoDraft").entries({
      OrderNo: "Order at " + new Date().toLocaleString(),
      Items: [{ product: { ID: `${book}` }, title, price, quantity }],
      buyer,
      createdBy: buyer,
      currency,
    });
  });

  //
  // Update Books' average ratings when ReviewsService signals updated reviews
  //
  ReviewsService.on("AverageRatings.Changed", (msg) => {
    console.debug("> received:", msg.event, msg.data); // eslint-disable-line no-console
    const { subject, reviews, rating } = msg.data;
    return UPDATE(Books, subject).with({ reviews, rating });
  });

  //
  // Reduce stock of ordered books for orders are created from Orders admin UI
  //
  OrdersService.on("OrderChanged", (msg) => {
    console.debug("> received:", msg.event, msg.data); // eslint-disable-line no-console
    const { product, deltaQuantity } = msg.data;
    return UPDATE(Books).where("ID =", product).and("stock >=", deltaQuantity).set("stock -=", deltaQuantity);
  });
});
