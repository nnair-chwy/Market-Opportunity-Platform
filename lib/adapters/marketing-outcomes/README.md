# Weekly DMA marketing outcomes

This adapter accepts a reviewed aggregate CSV at one row per `DMA_CODE × WEEK_START_DATE × CHANNEL`.

Required columns: `DMA_CODE`, `WEEK_START_DATE`, `CHANNEL`, `SPEND`, `ORDER_COUNT`.

Recommended value columns: `NEW_CUSTOMER_COUNT`, `CONTRIBUTION`.

The file must not contain customer, order, address, patient, employee, email, or phone identifiers. DMA remains the reporting geography: this contract never silently converts DMA to CBSA.
