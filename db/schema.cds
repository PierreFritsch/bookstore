namespace sap.capire.bookstore;

entity Periods {
  key ID          : String(10);
      description : String(100);
      validFrom   : Date;
      validTo     : Date;
}
