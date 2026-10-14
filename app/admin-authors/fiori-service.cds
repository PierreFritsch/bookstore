using {AdminService} from '@capire/bookshop';

annotate AdminService.Authors with @odata.draft.enabled;

////////////////////////////////////////////////////////////////////////////
//
//	Authors Object Page
//
annotate AdminService.Authors with @(UI: {
  PresentationVariant: {
    SortOrder     : [{
      Property  : externalIdDisplay,
      Descending: false
    }],
    Visualizations: ['@UI.LineItem'],
  },
  LineItem           : [
    // Display the bare External ID in the Authors table
    {
      Value                : externalIdDisplay,
      ![@HTML5.CssDefaults]: {width: '8em'}
    },
    // Hide the #TextFirst "Name (External ID)" column in the Authors table
    {
      Value        : externalId,
      ![@UI.Hidden]: true
    },
    {Value: name},
    {Value: dateOfBirth},
    {Value: dateOfDeath},
    {Value: placeOfBirth},
    {Value: placeOfDeath},
  ],
  HeaderInfo         : {
    TypeName      : '{i18n>Author}',
    TypeNamePlural: '{i18n>Authors}',
    Description   : {Value: lifetime}
  },
  Facets             : [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Details}',
      Target: '@UI.FieldGroup#Details'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Books}',
      Target: 'books/@UI.LineItem'
    },
  ],
  FieldGroup #Details: {Data: [
    {Value: placeOfBirth},
    {Value: placeOfDeath},
    {Value: dateOfBirth},
    {Value: dateOfDeath},
    {
      Value: age,
      Label: '{i18n>Age}'
    },
  ]},
  SelectionFields    : [
    externalIdDisplay,
    name
  ]
});

// Workaround to avoid errors for unknown db-specific calculated fields above
extend sap.capire.bookshop.Authors with {
  virtual age      : Integer;
  virtual lifetime : String;
}

annotate AdminService.Authors with {
  age               @Common.Label: '{i18n>Age}';
  lifetime          @Common.Label: '{i18n>Lifetime}';
  externalIdDisplay @title       : '{i18n>ExternalID}';
}

annotate AdminService.Authors with @(Common.SideEffects: {
  SourceProperties: [
    'dateOfBirth',
    'dateOfDeath'
  ],
  TargetProperties: [
    'age',
    'lifetime'
  ]
});

// Workaround for Fiori popup for asking user to enter a new UUID on Create
annotate AdminService.Authors with {
  ID @Core.Computed;
}

extend service AdminService {
  @readonly
  @cds.redirection.target: false
  entity AuthorsVH as
    projection on AdminService.Authors {
      ID,
      externalId,
      externalIdDisplay,
      name
    };
}

annotate AdminService.AuthorsVH with @(UI.SelectionFields: [
  externalIdDisplay,
  name
], );

annotate AdminService.AuthorsVH with {
  ID          @Common.ExternalID: externalIdDisplay  @Common.TextArrangement: #TextFirst  @UI.Hidden;
  externalId  @Common           : {
    Text           : name,
    TextArrangement: #TextFirst
  }                                                  @UI.Hidden;
};
