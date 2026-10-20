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

  // Filter Fields in the Filter Bar of the Authors list report
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

////////////////////////////////////////////////////////////////////////////
//
//	Authors Value Help
//

// AuthorsVH exists solely to scope VH-specific annotations away from the Authors list page.
// Because Authors.externalId carries @Common.Text: name + @Common.TextArrangement: #TextFirst,
// FEv4 automatically expands any VH column referencing externalId/externalIdDisplay into two
// "External ID" columns (one TextFirst, one bare). The only way to suppress the TextFirst
// column in the VH dialog — without hiding externalId globally on Authors — is to annotate
// it @UI.Hidden on a separate projection scoped to the VH context.
extend service AdminService {
  @readonly
  // Prevent FEv4 from redirecting Author navigations to this VH entity instead of Authors.
  @cds.redirection.target: false
  @cds.odata.valuelist
  entity AuthorsVH as
    projection on AdminService.Authors {
      ID,
      externalId,
      externalIdDisplay,
      name
    };
}

annotate AdminService.AuthorsVH with @(
  UI.SelectionFields : [externalIdDisplay, name],
  UI.Identification  : null  // clear inherited [{ Value: name }] so @ValueList.entity falls through to displaying all non-key String fields as columns in the VH dialog
);

annotate AdminService.AuthorsVH with {
  ID         @UI.Hidden
             @Common.ExternalID     : externalIdDisplay;

  // @UI.Hidden suppresses the TextFirst "Name (ExternalID)" column that FEv4 would otherwise
  // render automatically because of @Common.Text: name on externalId.
  externalId @UI.Hidden
             @Common.Text           : name
             @Common.TextArrangement: #TextFirst;
};
