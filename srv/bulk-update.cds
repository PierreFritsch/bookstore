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

using { cuid } from '@sap/cds/common';

service BulkUpdateService {

  @odata.draft.enabled
  entity Parents : cuid {
    description  : String;
    children     : Composition of many Children on children.parent = $self;
  }

  entity Children : cuid {
    parent       : Association to Parents;
    value        : Decimal(10,2);
    category     : String(10);
    status       : String(2);
    comment      : String(5000);
  }
}
