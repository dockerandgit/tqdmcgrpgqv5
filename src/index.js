'use strict';

// Importing node-fetch
const fetch = require('node-fetch'); 
const timeSpan = require('@kikobeats/time-span')({ format: n => `${Math.round(n)}ms` });
const debug = require('debug-logfmt')('tesla-inventory');
const pRetry = require('p-retry');

const inventories = require('./inventories');

const ITEMS_PER_PAGE = 50;

// Function to filter unique items by VIN
const uniqBy = (arr, prop) =>
  arr.filter((x, i, self) => i === self.findIndex(y => x[prop] === y[prop]));

// Default error handling function
const onFailedAttemptDefault = (error, debug) => debug.error(error);

// Main exported function to fetch Tesla inventory
module.exports = fetcher => 
  async (inventory, opts, { retries = 2, onFailedAttempt = onFailedAttemptDefault, ...fetcherOpts } = {}) => {
    // Validate inventory
    if (!inventories[inventory]) {
      throw new TypeError(`Tesla inventory \`${inventory}\` not found!`);
    }

    // Format model option if needed
    if (opts.model && !opts.model.startsWith('m')) {
      opts.model = `m${opts.model}`;
    }

    // Prepare the query parameters
    const { country, ...query } = { ...inventories[inventory], ...opts };
    const domain = inventory === 'cn' ? 'cn' : 'com';
    const duration = timeSpan();

    // Paginate results
    const paginate = async (offset = 0) => {
      const url = new URL(
        `https://www.tesla.${domain}/inventory/api/v4/inventory-results?${new URLSearchParams({
          query: JSON.stringify({
            query,
            count: ITEMS_PER_PAGE,
            offset,
            outsideOffset: offset,
            outsideSearch: true
          })
        }).toString()}`
      ).toString();

      debug({ url, offset, ...query });

      // Fetch data with retry logic
      const result = await pRetry(
        () =>
          fetch(url, fetcherOpts) // Use fetch directly
            .then(res => res.text()) // Get the response as text
            .then(async body => {
              try {
                const data = JSON.parse(body); // Parse the JSON response
                return { items: data.results ?? [] }; // Return the items array
              } catch (error) {
                error.body = body;
                throw error;
              }
            }),
        {
          onFailedAttempt: error => onFailedAttempt(error, debug),
          retries
        }
      );

      return result;
    };

    let offset = 0;
    let items = [];
    let page;
    let pageIndex = -1;

    // Loop through pages until all items are fetched
    do {
      page = await paginate(offset);
      ++pageIndex;
      items = uniqBy(items.concat(page.items), 'VIN');
      offset = items.length;
    } while ((pageIndex !== 0 || page.items.length >= ITEMS_PER_PAGE) && page.items.length > 0);

    debug.info({ inventory, ...opts, items: items.length, duration: duration() });

    // Return filtered items based on model
    return items.filter(item => item.Model === opts.model);
  };
