namespace sap.capire.bookstore;

entity Periods {
  key ID          : String(10);
      description : String(100) @title: 'Description';
      validFrom   : Date        @title: 'Valid From';
      validTo     : Date        @title: 'Valid To';
}
