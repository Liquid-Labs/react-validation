import { actionTypes } from './actions'

import isEqual from 'lodash.isequal'

const settings = {
  historyLength  : 10,
  updateCallback : undefined,
}

const INITIAL_STATE = {
  origData    : undefined,
  dataHistory : [],
  fieldData   : { /*
    fieldName : {
      value: <some primitive value>,
      validators: [ array of validator functions ]
      errorMsg : <current error message string> | null,
      touched: false | true
    } */
  }
}

/**
 * 'fieldEntryTemplate' is a convenience template for 'fieldData' entries.
 */
const fieldEntryTemplate = {
  value      : undefined,
  validators : [],
  errorMsg   : null,
  touched    : false
}

/**
 * 'validateFieldsValue' checks the given 'value' against the 'validators' and
 * returns the first error message produced or 'null' no validation failed.
 */
const validateFieldValue = (value, validators) => {
  // First validator to fail is the one we use.
  let errorMsg = null
  validators.some((validator) => {
    errorMsg = validator(value)
    return errorMsg
  })
  return errorMsg
}

/**
 * 'exportDataFromState' reduces the 'state'
 */
const exportDataFromState = (state) => Object.entries(state.fieldData)
  .reduce((data, [fieldName, fieldEntry]) => {
    data[fieldName] = fieldEntry.value
    return data
  }, {})

/**
 * 'processDataUpdate' returns a field entry to track the validation state of
 * the 'data' parameter.
 */
const processDataUpdate = (data) =>
  Object.entries(data).reduce((fieldData, [fieldName, value]) => {
    fieldData[fieldName] = { ...fieldEntryTemplate, value }
    return fieldData
  }, {})

/**
 * 'processFieldUpdate' updates the value and error message for a field entry.
 * Note that for efficiency, the current value of the field entry should be
 * checked to see if processing is needed prior to invoking this method.
 */
const processFieldUpdate = (fieldEntry, value) => ({
  ...fieldEntry,
  errorMsg : validateFieldValue(value, fieldEntry.validators),
  value    : value
})

/**
 * 'processHistoryUpdate' potentialy generates a new 'dataHistory' to capture
 * the current state of the data. If the current data is equivalent to the most
 * recent history state, then the current 'state.dataHistory' is returned.
 * Otherwise, a new array, of length 'historyLength' or less, is generated and
 * returned.
 */
const processHistoryUpdate = (state) => {
  const { dataHistory } = state
  if (dataHistory.length === 0) return [ exportDataFromState(state) ]
  // else
  const currData = exportDataFromState(state)
  if (isEqual(dataHistory[dataHistory.length - 1], currData)) {
    return dataHistory
  }
  else {
    // We use 'concat' to create a new array.
    const newHistory = dataHistory.concat([ currData ])
    // Should never need to shift more than one, but...
    while (newHistory.length > settings.historyLength) newHistory.shift()
    return newHistory
  }
}

const reducer = (state, action) => {
  switch (action.type) {
  case actionTypes.UPDATE_DATA : {
    const { data } = action
    if (process.env.NODE_ENV !== 'production') {
      if (state.origData !== undefined) {
        // eslint-disable-next-line no-console
        console.warn(`Updating the validation data directly causes the data history to be reset. To avoid this warning, call 'reset()' explicitly before updatin the data.`)
      }
    }
    return {
      origData    : data,
      dataHistory : [ data ],
      fieldData   : processDataUpdate(data)
    }
  }

  case actionTypes.UPDATE_FIELD_VALUE : {
    const { fieldName, value } = action
    if (value === undefined) throw new Error(`Value (for '${fieldName}') cannot be 'undefined'.`)
    const fieldEntry = state.fieldData[fieldName] || fieldEntryTemplate
    // note template 'value' is 'undefined', and per above check, 'value' can
    // never be 'undefined'.
    if (fieldEntry.value !== value) {
      return {
        ...state,
        fieldData : {
          ...state.fieldData,
          [fieldName] : {
            ...
            processFieldUpdate(fieldEntry, value)
          }
        }
      }
    }
    else /* there's a 'fieldData' entry with the same value; */ return state
  }

  case actionTypes.BLUR_FIELD : {
    const { fieldName } = action
    const fieldEntry = state.fieldData[fieldName] || fieldEntryTemplate
    const newHistory = processHistoryUpdate(state)
    if (!fieldEntry.touched || newHistory !== state.dataHistory) {
      return {
        ...state,
        dataHistory : newHistory,
        fieldData   : {
          ...state.fieldData,
          [fieldName] : { ...fieldEntry, touched : true }
        }
      }
    }
    else /* field already touched, no change in history */ return state
  }

  case actionTypes.UPDATE_FIELD_VALIDATORS : {
    const { fieldName, validators } = action
    // These don't generally change, so we don't bother to check if different.
    const fieldEntry = state.fieldData[fieldName] || fieldEntryTemplate
    return {
      ...state,
      fieldData : {
        ...state.fieldData,
        [fieldName] : { ...fieldEntry, validators }
      }
    }
  }

  case actionTypes.RESET : return INITIAL_STATE
  default : throw new Error(`Unrecognized action type: '${action.type}'.`)
  } // switch (action.type)
} // reducer

export { exportDataFromState, INITIAL_STATE, reducer, settings }
