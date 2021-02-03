# 𝚒𝚗𝚝𝚎𝚐𝚛𝚒𝚏𝚢

🤝  Enforce referential and data integrity in [Cloud Firestore](https://firebase.google.com/docs/firestore/) using [triggers](https://firebase.google.com/docs/functions/firestore-events)

**This library was forked from [anishkny/integrify](https://github.com/anishkny/integrify)**

## Description

Relational databases have the benefit of using foreign keys (FK) to enforce links between tables as shown below

```
*Customers Table*
| customerId (PK) | firstName  | lastName  | email             | nOrders |
|-----------------|------------|-----------|-------------------|---------|
| 1213            | First Name | Last name | customer@email... | 14      |

*Orders Table*
| orderId (PK) | customerId (FK) | amount | cFirstName | cLastName |
|--------------|-----------------|--------|------------|-----------|
| 764          | 1213            | £15.32 | First name | Last name |

*Delivery Attempts Table*
| deliveryId (PK) | orderId (FK) | customerId (FK) | cFirstName | completed |
|-----------------|--------------|-----------------|------------|-----------|
| 623             | 764          | 1213            | First name | true      |
```

A `JOIN` query can be used to get the data between the two tables or a `DELETE CASCADE` can be used to delete the rows in another table. This is not possible in Firestore, the concept of primary and foreign keys don't exist as it is a collection of documents.

To achieve the same results with Firestore, you would need to keep fields in the document you will query and use [triggers](https://firebase.google.com/docs/functions/firestore-events) to keep the data integrity and ensure that the references are never stale.

For the example above, the Firestore structure would look as follows

```
*Customers Collection*
/customers
  /1213
    firstName: 'First name'
    lastName: 'Last name'
    email: 'customer@email.com'
    nOrders: 14 

    /* Or nOrders could be moved to a sub-collection */
    /orders
      /completed
        nOrders: 14

*Orders Collection*
/orders
  /764
    customerId: 1213
    amount: '£15.32'
    cFirstName: 'First name'
    cLastName: 'Last name'

    /deliveryAttempts
      /623
        customerId: 1213
        cFirstName: 'First name'
        completed: true
```

If the customer updates their first name in the `customers` collection then the `orders` and `deliveryAttempts` will be out of sync. You will need a function (`onUpdate`) that is triggered every time there is an update to a `customers` document to update the `orders` and `deliveryAttempts` documents `cFirstName` field. Similarly, if a `customers` document is deleted (`onDelete`) then the `orders` documents that belong to the customer should be deleted too. Every time an order is added or deleted in the `orders` collection, it should update the `nOrders` for the customer by incrementing or decrementing the field.

Integrify allows you to create the functions in a simpler and easy-to-read way. You provided the `source` that the function must keep a watch on and the `targets` that need to be updated whenever the event specified occurs on the source collection.

The `hooks` allow you to perform any additional logic before (`pre`) or after (`post`) the update to the target has been executed.

## Example Usage

#### REPLICATE

```js
// index.js
const { integrify } = require('integrify');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

integrify({ config: { functions, db } });

// Automatically replicate attributes from source to target
module.exports.onCustomerUpdated = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'customers/{customerId}',
    // OR
    collection: 'customers', // <-- The document ID placeholder can be omitted
  },
  targets: [
    {
      collection: 'orders',
      foreignKey: 'customerId',
      // NOTE: The attributeMapping key refers to the source field and the value refers to the target field
      attributeMapping: {
        firstName: 'cFirstName',
        lastName: 'cLastName',
        // NOTE: If a field is missing after the update, the field will be deleted
      },
    },

    // Can have multiple targets
    {
      collection: 'deliveryAttempts',
      foreignKey: 'customerId',
      attributeMapping: {
        firstName: 'cFirstName',
      },
      // Optional:
      isCollectionGroup: true, // Replicate into collection group, this will require an index, see more below
    },
  ],

  // Optional:
  hooks: {
    pre: (change, context) => {
      // Code to execute before replicating attributes
      // See: https://firebase.google.com/docs/functions/firestore-events
    },
    post: (change, context) => {
      // Code to execute after replicating attributes
      // See: https://firebase.google.com/docs/functions/firestore-events
    },
  },
});
```

#### DELETE

```js
// index.js
const { integrify } = require('integrify');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

integrify({ config: { functions, db } });

// Automatically delete stale references
module.exports.onCustomerDeleted = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'customers/{customerId}',
    // OR
    collection: 'customers', // <-- The document ID placeholder can be omitted
  },
  targets: [
    {
      collection: 'orders',
      foreignKey: 'customerId', // Optional: Delete document with matching foreign key
      deleteAll: false, // Optional: Delete all from collection
      // EITHER 'foreignKey' OR 'deleteAll' MUST BE PROVIDED
      isCollectionGroup: true,  // Optional: Delete from collection group, see more below
    },
    {
      collection: 'orders/$orderId/deliveryAttempts', // Can reference source ID, this must match the source document ID, will throw and error if it doesn't exist
      // OR
      collection: 'orders/$source.orderId/deliveryAttempts', // Can reference a field value (requires $source. before the field name), will throw error if it doesn't exist
      foreignKey: 'customerId',
    },
  ],

  // Optional:
  hooks: {
    pre: (snap, context) => {
      // Code to execute before deleting references
      // See: https://firebase.google.com/docs/functions/firestore-events
    },
    post: (snap, context) => {
      // Code to execute after deleting references
      // See: https://firebase.google.com/docs/functions/firestore-events
    },
  },
});
```

#### MAINTAIN COUNT

```js
// index.js
const { integrify } = require('integrify');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

integrify({ config: { functions, db } });

// Automatically maintain count
module.exports.onMaintainCustomerOrderCount = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'orders/{orderId}',
    // OR
    collection: 'orders', // <-- The document ID placeholder can be omitted
  },
  target: {
    collection: 'customers/$source.customerId', // NOTE: The target,document should refer to the document that will be maintained
    // OR
    collection: 'customers/$source.customerId/orders/completed', // Can reference a field value (requires source), will throw error if it doesn't exist
    attribute: 'nOrders',

    // Optional:
    hooks: {
      pre: (foreignKey) => {
        // Code to execute before using the foreignKey in the target
        // This allows the foreignKey to be modified before using it in the path
      },
    },
  },
});
```

Deploy to Firebase by executing:

```bash
$ firebase deploy --only functions
```

### Rules File

Alternately, rules can be specified in a file named `integrify.rules.js`.

```js
// index.js
const { integrify } = require('integrify');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

integrify({ config: { functions, db } });

// Rules will be loaded from "integrify.rules.js"
module.exports = integrify();
```

```js
// integrify.rules.js
module.exports = [
  {
    rule: 'REPLICATE_ATTRIBUTES',
    name: 'replicateMasterToDetail',
    // ...
  },
  // ...
];
```

### Collection Groups (`isCollectionGroup`)

Firestore allows searching over multiple collections (a.k.a. collection group) with the same name at any level in the database. This is called a [collection group query](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query).

Integrify allows you to replicate tracked master attributes into (optionally) collection groups linked by a foreign key using the `isCollectionGroup` parameter (see above) in the `REPLICATE_ATTRIBUTES` rule. Similarly, you can delete references in a collection group (instead of just a collection) using the `isCollectionGroup` in the `DELETE_REFERENCES` rule.

**Note:** You need to first create the appropriate index to be able to use Collection Group Queries. The first time you attempt to use it, Firebase will throw an error message with a link which when clicked will prompt you to create the appropriate index. For example:

```
The query requires a COLLECTION_GROUP_ASC index for collection detail1 and field masterId. You can create it here: https://console.firebase.google.com/project/integrify-dev/database/firestore/indexes/single_field?create_exemption=ClNwcm9qZWNxxxxxx3RlcklkEAE
```

For more help, see [here](https://firebase.google.com/docs/firestore/query-data/indexing).