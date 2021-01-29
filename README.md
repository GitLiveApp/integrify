# 𝚒𝚗𝚝𝚎𝚐𝚛𝚒𝚏𝚢

🤝  Enforce referential and data integrity in [Cloud Firestore](https://firebase.google.com/docs/firestore/) using [triggers](https://firebase.google.com/docs/functions/firestore-events)

**This library was forked from [anishkny/integrify](https://github.com/anishkny/integrify)**

## Description

Relational databases have the benefit of using foreign keys (FK) to enforce links between tables as shown below

```
*Customer Table*
| Customer ID (PK) | Name          | Email             |
|------------------|---------------|-------------------|
| 1213             | Customer Name | customer@email... |

*Order Table*
| Order ID (PK) | Customer ID (FK) | Amount |
|---------------|------------------|--------|
| 764           | 1213             | £15.32 |
```

A `JOIN` query can be used to get the data between the two tables or a `DELETE CASCADE` can be used to delete the rows in another table. This is not possible in Firestore, the concept of primary and foreign keys don't exist as it is a collection of documents.

To achieve the same results with Firestore, you would need to keep fields in the document you will query and use [triggers](https://firebase.google.com/docs/functions/firestore-events) to keep the data integrity and ensure that the references are never stale.

For the example above, the Firestore structure would look as follows

```
*Customer Collection*
| Customer ID (PK) | Name          | Email             | # Orders |
|------------------|---------------|-------------------|----------|
| 1213             | Customer Name | customer@email... | 14       |

*Order Collection*
| Order ID (PK) | Customer ID (FK) | Amount | Customer Name |
|---------------|------------------|--------|---------------|
| 764           | 1213             | £15.32 | Customer Name |
```

If the customer updated their name then the orders will be. You will need a function (`onUpdate`) that is trigger every time there is an update to the customer table to update the order table's `Customer Name`. Similarly, if the customer is deleted (`onDelete`) then the orders that belong to the customer should be deleted too. Every time an order is added or deleted in the orders collection, it should update the `# Orders` for the customer by incrementing or decrementing the field.

Integrify allow you to create the functions in a simpler and easy-to-read way. You provided the `source` that the function must keep a watch on and the `targets` that need to be updated whenever the event specified occurs on the source collection.

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
    collection: 'customers', // <-- This will append {masterId}
	    // OR
		collection: 'customers/{customerId}', // <-- Can be any string as in Firebase
	},
	targets: [
    {
			collection: 'orders',
			foreignKey: 'customerId',
      attributeMapping: {
        firstName: 'customerFirstName', // If an field is missing after the update, the field will be deleted
        lastName: 'customerLastName',
      },
    },
    {
      collection: 'deliveryAddress',
      foreignKey: 'customerId',
      attributeMapping: {
        firstName: 'customerFirstName',
        lastName: 'customerLastName',
      },
      // Optional:
      isCollectionGroup: true, // Replicate into collection group, see more below
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
    collection: 'customers', // <-- This will append {masterId}
    // OR
    collection: 'customers/{cusomterId}', // <-- Can be any string as in Firebase
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
      collection: 'orders/$master/delivered', // Can reference source ID, will throw error if it doesn't exist
      // OR
      collection: 'orders/$source.fieldValue/delivered', // Can reference a field value (requires source), will throw error if it doesn't exist
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
    collection: 'orders',
	},
	target: {
    collection: 'customers/$source.cusomerId', // NOTE: This collection needs to reference a document
    // OR
    collection: 'customers/$source.cusomerId/orders/initial', // Can reference a field value (requires source), will throw error if it doesn't exist
    attribute: 'orderCount',

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