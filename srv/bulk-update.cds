/**
 * Minimal model used by the hana-update-grouping reproducer test.
 *
 * A draft-enabled Parent entity with a Composition of many Children is all
 * that is needed to trigger the HANA adapter bug: when a deep UPDATE on the
 * parent carries many children that all share the same column value, the
 * adapter groups the per-child SQL UPDATEs into one statement with a large
 * WHERE ID IN (…) list that exceeds the HANA maximum SQL packet size.
 */

service BulkUpdateService {

  @odata.draft.enabled
  entity Parents {
    key ID       : Integer;
    description  : String;
    children     : Composition of many Children on children.parent_ID = ID;
  }

  entity Children {
    key ID        : Integer;
        parent_ID : Integer;
        value     : Decimal(10,2);
        category  : String;
  }
}
