/**
 * Reproducer for the UPDATE grouping / IN-list packet size issue on SAP HANA.
 *
 * When many draft child entities are updated with the same column values, the
 * persistence layer groups them into a single SQL statement:
 *
 *   UPDATE <entity>_drafts SET col = ? WHERE ID IN (?, ?, …, ?)
 *
 * with every affected child ID in the IN-list.  For large datasets (≥ ~4 000
 * rows with UUID keys) the total size of bound parameters exceeds the maximum
 * SQL packet size supported by SAP HANA, causing:
 *
 *   "Failed to set parameters, maximum packet size exceeded."
 *
 * The persistence layer should chunk the IN-list so that each individual SQL
 * statement stays within the packet-size limit.
 *
 * HOW TO REPRODUCE (SAP HANA — see section at bottom of this file)
 * -----------------------------------------------------------------
 */

'use strict'

const cds = require('@sap/cds')

// Prevent cds.test from trying to connect to remote services
cds.env.requires.OrdersService = { credentials: { url: 'http://localhost:4006/orders' } }
cds.env.requires.ReviewsService = { credentials: { url: 'http://localhost:4007/reviews' } }

const { expect } = cds.test('.')

const CHILD_COUNT = Number(process.env.CHILD_COUNT_OVERRIDE) || 5_000
const PARENT_ID   = cds.utils.uuid()
const DRAFT_UUID  = cds.utils.uuid()

describe('HANA — UPDATE with large WHERE ID IN (...) list', () => {
  let childIDs

  beforeAll(async () => {
    childIDs = Array.from({ length: CHILD_COUNT }, () => cds.utils.uuid())

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

    // Insert CHILD_COUNT draft Children all sharing the same initial values.
    // Done in chunks of 1000 to stay within single-statement parameter limits.
    for (let i = 0; i < CHILD_COUNT; i += 1_000) {
      const chunk = childIDs.slice(i, i + 1_000).map(id => ({
        ID:                                id,
        parent_ID:                         PARENT_ID,
        value:                             10.0,
        category:                          'A',
        status:                            'IP',
        comment:                           null,
        IsActiveEntity:                    false,
        HasActiveEntity:                   false,
        HasDraftEntity:                    false,
        DraftAdministrativeData_DraftUUID: DRAFT_UUID,
      }))
      await cds.db.run(
        INSERT.into('BulkUpdateService.Children.drafts').entries(chunk)
      )
    }
  })

  afterAll(async () => {
    await cds.db.run(DELETE.from('BulkUpdateService.Children.drafts').where({ parent_ID: PARENT_ID }))
    await cds.db.run(DELETE.from('BulkUpdateService.Parents.drafts').where({ ID: PARENT_ID }))
    await cds.db.run(DELETE.from('DRAFT.DraftAdministrativeData').where({ DraftUUID: DRAFT_UUID }))
  })

  it(`UPDATEs ${CHILD_COUNT} draft Children with a single WHERE ID IN (...) clause`, async () => {
    // This is what the persistence layer generates when all children share the
    // same changed data (e.g., all get status = 'SC', category = 'B').
    // It groups them into a single UPDATE ... SET ... WHERE ID IN (...).
    //
    // With UUID keys (NVARCHAR(36)), each ID in the IN-list occupies ~36 bytes
    // of the parameter payload. For 5000 UUIDs that's ~180 KB of parameters,
    // which combined with the SQL text can exceed HANA's max packet size.
    const query = UPDATE.entity('BulkUpdateService.Children.drafts')
      .set({ status: 'SC', category: 'B' })
      .where({ ID: { in: childIDs } })

    await cds.db.run(query)

    // Verify
    const updated = await cds.db.run(
      SELECT.from('BulkUpdateService.Children.drafts')
        .where({ parent_ID: PARENT_ID, status: 'SC' })
        .columns('count(ID) as count')
    )
    expect(updated[0].count).to.equal(CHILD_COUNT)
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
 * With CHILD_COUNT=5000 (default), the UPDATE generates a single SQL statement:
 *
 *   UPDATE BULKUPDATESERVICE_CHILDREN_DRAFTS SET STATUS = ?, CATEGORY = ?
 *   WHERE ID IN (?, ?, …, ?)   -- 5 000 UUID parameters
 *
 * HANA rejects this with:
 *   "Failed to set parameters, maximum packet size exceeded."
 * → The test fails.
 *
 * With CHILD_COUNT=100 or CHILD_COUNT=1000, the IN-list is small enough to
 * fit within the packet-size limit.
 * → The test passes.
 *
 * Expected result (fixed)
 * -----------------------
 * The persistence layer chunks the IN-list into smaller batches and issues
 * multiple UPDATE statements, each staying within the HANA packet-size limit.
 * → The test passes at any child count.
 * ──────────────────────────────────────────────────────────────────────────────
 */
