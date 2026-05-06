/**
 * Reproducer for the HANA adapter UPDATE grouping / chunking issue.
 *
 * When a deep UPDATE is issued on a composition root carrying a large number
 * of child entities that all share the same value for one or more columns,
 * the HANA DB adapter generates a single UPDATE statement:
 *
 *   UPDATE <entity>_drafts SET col = ? WHERE ID IN (?, ?, …, ?)
 *
 * with every draft child ID in the IN-list.  For large datasets (≥ ~1 000
 * rows) this exceeds the maximum SQL packet size supported by SAP HANA,
 * causing: "Failed to set parameters, maximum packet size exceeded."
 *
 * The adapter should chunk the IN-list so that each individual SQL
 * statement stays within the packet-size limit.
 *
 * HOW TO REPRODUCE (SAP HANA — see section at bottom of this file)
 * -----------------------------------------------------------------
 */

'use strict'

const cds = require('@sap/cds')

// Prevent cds.test from trying to connect to the remote OrdersService
cds.env.requires.OrdersService = { credentials: { url: 'http://localhost:4006/orders' } }

const { expect } = cds.test('.')

const CHILD_COUNT = Number(process.env.CHILD_COUNT_OVERRIDE) || 5_000
const PARENT_ID   = 1
const DRAFT_UUID  = cds.utils.uuid()

describe('HANA adapter — UPDATE grouping without IN-list chunking', () => {
  beforeAll(async () => {
    // Shared DraftAdministrativeData row required by all draft children
    await cds.db.run(
      INSERT.into('DRAFT.DraftAdministrativeData').entries({
        DraftUUID:            DRAFT_UUID,
        CreationDateTime:     new Date().toISOString(),
        CreatedByUser:        'alice',
        LastChangeDateTime:   new Date().toISOString(),
        LastChangedByUser:    'alice',
        InProcessByUser:      'alice',
        DraftIsCreatedByMe:   true,
        DraftIsProcessedByMe: true,
      })
    )

    // Parent draft row
    await cds.db.run(
      INSERT.into('BulkUpdateService.Parents.drafts').entries({
        ID:                                PARENT_ID,
        description:                       'Reproducer parent',
        IsActiveEntity:                    false,
        HasActiveEntity:                   false,
        HasDraftEntity:                    false,
        DraftAdministrativeData_DraftUUID: DRAFT_UUID,
      })
    )

    // Insert CHILD_COUNT draft Children all sharing the same initial value.
    // Done in chunks of 1 000 to stay within single-statement parameter limits.
    const children = Array.from({ length: CHILD_COUNT }, (_, i) => ({
      ID:                                1_000_000 + i,
      parent_ID:                         PARENT_ID,
      value:                             10.0,
      category:                          'A',
      IsActiveEntity:                    false,
      HasActiveEntity:                   false,
      HasDraftEntity:                    false,
      DraftAdministrativeData_DraftUUID: DRAFT_UUID,
    }))

    for (let i = 0; i < children.length; i += 1_000) {
      await cds.db.run(
        INSERT.into('BulkUpdateService.Children.drafts').entries(children.slice(i, i + 1_000))
      )
    }
  })

  afterAll(async () => {
    await cds.db.run(DELETE.from('BulkUpdateService.Children.drafts').where({ parent_ID: PARENT_ID }))
    await cds.db.run(DELETE.from('BulkUpdateService.Parents.drafts').where({ ID: PARENT_ID }))
    await cds.db.run(DELETE.from('DRAFT.DraftAdministrativeData').where({ DraftUUID: DRAFT_UUID }))
  })

  it(`deep-UPDATEs ${CHILD_COUNT} draft Children sharing the same new value without exceeding the DB packet size`, async () => {
    // Build the deep-update payload: all children get the same new value and
    // category.  This mirrors a mass-import that writes back many child rows
    // with identical column values via a single deep UPDATE on the composition
    // root.
    //
    // On SAP HANA the adapter groups the per-child UPDATEs into one statement:
    //
    //   UPDATE BulkUpdateService_Children_drafts
    //   SET value = ?, category = ?
    //   WHERE ID IN (?, ?, …, ?)   -- 5 000 bound parameters
    //
    // HANA rejects this with "Failed to set parameters, maximum packet size
    // exceeded."  A fixed adapter would chunk the IN-list.
    const childrenPayload = Array.from({ length: CHILD_COUNT }, (_, i) => ({
      ID:       1_000_000 + i,
      value:    20.0,
      category: 'B',
    }))

    const srv = cds.services['BulkUpdateService']
    await srv.tx({ user: new cds.User('alice') }, async () => {
      const req = new cds.Request({
        event: 'UPDATE',
        data: { children: childrenPayload },
        query: UPDATE('BulkUpdateService.Parents')
          .set({ children: childrenPayload })
          .where({ ID: PARENT_ID, IsActiveEntity: false }),
        target: srv.entities['Parents'],
      })
      await srv.dispatch(req)
    })

    // Verify that all draft Children were updated with the new value
    const updated = await cds.db.run(
      SELECT.from('BulkUpdateService.Children.drafts')
        .where({ parent_ID: PARENT_ID })
        .columns('value')
        .limit(1)
    )
    expect(Number(updated[0]?.value)).to.equal(20.0)
  })
})

/*
 * ─── HOW TO REPRODUCE AGAINST SAP HANA ────────────────────────────────────────
 *
 * Prerequisites
 * -------------
 * 1. A running SAP HANA Cloud instance reachable from your machine.
 * 2. HANA credentials configured for the hybrid profile, e.g. via:
 *      cds bind db --to <hana-service-instance>:<service-key>
 *    which writes the binding into .cdsrc-private.json.
 *
 * Setup
 * -----
 *   git clone https://github.com/PierreFritsch/bookstore.git
 *   cd bookstore
 *   git checkout bug/hana-update-grouping-chunk-cds8
 *   npm install
 *
 *   # Deploy the schema to your HANA instance (replace <db-name> with the
 *   # name of your HANA HDI service instance):
 *   cds deploy --to hana:<db-name>
 *
 * Run the test
 * ------------
 *   cds bind --exec -- npx chest test/hana-update-grouping.test.js
 *
 * Observed result (CDS 8.9.10 / @sap/cds-hana 2.1.0 — broken)
 * ---------------------------------------------------------------
 * The HANA adapter issues one single UPDATE statement:
 *
 *   UPDATE BULKUPDATESERVICE_CHILDREN_DRAFTS SET VALUE = ?, CATEGORY = ?
 *   WHERE ID IN (?, ?, …, ?)   -- 5 000 bound parameters
 *
 * HANA rejects this with:
 *   "Failed to set parameters, maximum packet size exceeded."
 * → The test fails.
 *
 * Expected result (fixed)
 * -----------------------
 * The adapter chunks the IN-list and issues multiple UPDATE statements, each
 * staying within the HANA packet-size limit.
 * → The test passes.
 * ──────────────────────────────────────────────────────────────────────────────
 */
