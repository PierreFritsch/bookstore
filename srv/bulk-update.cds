/**
 * Minimal model used by the hana-update-grouping reproducer test.
 *
 * A draft-enabled Parent entity with a Composition of many Children.
 * When all children share the same changed column value, the persistence
 * layer groups them into a single:
 *
 *   UPDATE <entity>_drafts SET col = ? WHERE ID IN (?, ?, …, ?)
 *
 * For large datasets this exceeds the HANA maximum SQL packet size.
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
