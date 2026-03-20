const cds = require ('@sap/cds')


// Add routes to UIs from imported packages
if (!cds.env.production) cds.once ('bootstrap', (app) => {
  app.serve ('/bookshop') .from ('@capire/bookshop','app/vue')
  app.serve ('/orders') .from('@capire/orders','app/orders')
})


// Register handler on the serving AdminService instance
// so it runs before the generic handle_crud_requests handler that would otherwise throw a 501 for persistence-skipped entities.
cds.on ('serving', (srv) => {
  if (srv.name !== 'AdminService') return
  srv.prepend (() => {
    srv.on ('READ', 'AuthorizationRestrictions', () => {
      return { ID: 'SINGLETON', isDeleteForbidden: true, isCopyForbidden: true, isCreateForbidden: true }
    })
  })
})


// Mashing up bookshop services with required services...
cds.once ('served', async ()=>{

  const CatalogService = await cds.connect.to ('CatalogService')
  const OrdersService = await cds.connect.to ('OrdersService')
  const AdminService = await cds.connect.to ('AdminService')
  const db = await cds.connect.to ('db')

  // reflect entity definitions used below...
  const { Books } = cds.entities ('sap.capire.bookshop')

  //
  // Copy action on Authors
  //
  AdminService.on('Copy', 'Authors', async (req) => {
    const [{ ID }] = req.params
    const author = await SELECT.one.from('AdminService.Authors').where({ ID })
    if (!author) return req.error(404, `Author ${ID} not found`)
    const { id } = await SELECT.one.from('AdminService.Authors').columns('max(ID) as id')
    const copy = { ...author, ID: id + 4, name: `Copy of ${author.name}` }
    await INSERT.into('AdminService.Authors').entries(copy)
    return copy
  })

  //
  // Create an order with the OrdersService when CatalogService signals a new order
  //
  CatalogService.before ('submitOrder', async (req) => {
    const { book, quantity, buyer = req.user.id } = req.data
    const { title, price, currency } = await db.read (Books, book, b => { b.title, b.price, b.currency(c => c.code) })
    await OrdersService.create ('OrdersNoDraft').entries({
      OrderNo: 'Order at '+ (new Date).toLocaleString(),
      Items: [{ product:{ID:`${book}`}, title, price, quantity }],
      buyer, createdBy: buyer, currency
    })
  })

  //
  // Reduce stock of ordered books for orders are created from Orders admin UI
  //
  OrdersService.on ('OrderChanged', (msg) => {
    console.debug ('> received:', msg.event, msg.data) // eslint-disable-line no-console
    const { product, deltaQuantity } = msg.data
    return UPDATE (Books) .where ('ID =', product)
    .and ('stock >=', deltaQuantity)
    .set ('stock -=', deltaQuantity)
  })
})
