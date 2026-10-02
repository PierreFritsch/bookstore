using { AdminService } from '@capire/bookshop';

////////////////////////////////////////////////////////////////////////////
//
//  Period: list report columns
//
annotate AdminService.Periods with @(
    UI.LineItem: [
        { Value: ID,          Label: 'ID'          },
        { Value: description, Label: 'Description' },
        { Value: validFrom,   Label: 'Valid From'  },
        { Value: validTo,     Label: 'Valid To'    },
    ],
    UI.SelectionFields: [ ID, description, validFrom, validTo ],
);


////////////////////////////////////////////////////////////////////////////
//
//  Books: add period column to list report + period in filter bar by default
//
annotate AdminService.Books with @(
    UI.LineItem: [
        { Value: title,         Label: 'Title'  },
        { Value: author_ID,     Label: 'Author' },
        { Value: price,         Label: 'Price'  },
        { Value: stock,         Label: 'Stock'  },
        { Value: period_ID,     Label: 'Period' },
    ],
    UI.SelectionFields: [ period_ID ],
);


////////////////////////////////////////////////////////////////////////////
//
//  Books: value help for period
//
annotate AdminService.Books with {
    period @(Common: {
        Label    : 'Period',
        ValueList: {
            CollectionPath: 'Periods',
            Parameters: [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: period_ID,
                    ValueListProperty: 'ID',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'description',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'validFrom',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'validTo',
                },
            ],
        }
    });
}
