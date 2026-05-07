////////////////////////////////////////////////////////////////////////////
//
//    Enhancing bookshop with Orders provided through
//    respective reuse packages and services
//


//
//  Extend Orders with Books as Products
//
using { sap.capire.bookshop.Books } from '@capire/bookshop';
using { sap.capire.orders.Orders } from '@capire/orders';
extend Orders:Items with {
  book : Association to Books on product.ID = book.ID
}

// Ensure models from all imported packages are loaded
using from '@capire/orders/app/fiori';
using from '@capire/data-viewer';
using from '@capire/common';


// Restrict admin access to AdminService
annotate AdminService with @requires:'admin';
