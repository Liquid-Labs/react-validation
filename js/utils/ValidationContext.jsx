/**
 * ValidationContext is intended primarily as a 'form wrapper'. Once the initial
 * data is supplied, the form will manage the data internally. The updated data
 * may be accessed via the `useValidationAPI.getData()` or by supplying an
 * `updateCallback` function.
 *
 * The `updateCallback` is invoked when changes are "committed" by blurring a
 * field. Thus, intermediate changes as the a user types are not reflected
 * through `updateCallback`. If you need to process data as it changes, attach
 * an `onChange` function to the individual `ValidInput` components.
 *
 * The 'data' may be changed externally, though this will cause a warning unless
 * 'historyLength' is '0' or 'resetHistory' is 'true'. None of this should be
 * necessary for general usage, however.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import PropTypes from 'prop-types'

import isEqual from 'lodash.isequal'

import {
  exportDataFromFieldData,
  INITIAL_STATE,
  objToInputVal,
  reducer,
  settings } from './vclib/reducer'
import { actions } from './vclib/actions'

const DEFAULT_HISTORY_LENGTH = 10

const VContext = createContext()

const useValidationAPI = () => useContext(VContext)

const ValidationContext = ({
  data, // TODO: change to 'initialData'
  updateCallback,
  historyLength=DEFAULT_HISTORY_LENGTH,
  resetHistory=false,
  children }) => {

  const [ state, dispatch ] = useReducer(reducer, INITIAL_STATE)

  settings.historyLength = historyLength

  useMemo(() => {
    if (resetHistory) {
      dispatch(actions.resetHistory())
    }
  }, [state, resetHistory])

  // do we have an external data update?
  useMemo(() => {
    if (data !== undefined
        && ((state.origData === undefined && data)
            || (state.lastUpdate !== data
                && !isEqual(state.lastUpdate, data)))) {
      if (state.origData !== undefined && historyLength > 0 && !resetHistory) {
        // eslint-disable-next-line no-console
        console.warn(`Programatic update of data detected. Form history will be reset.`)
      }
      dispatch(actions.updateData(data, updateCallback))
    }
  }, [state.origData, state.lastUpdate, data])

  const api = useMemo(() => {
    const api = {
      getOrigData : () => state.origData,

      getData : () => exportDataFromFieldData(state.fieldData),

      hasFieldValue : (fieldName) => {
        const fieldEntry = state.fieldData[fieldName]
        return fieldEntry && fieldEntry.value !== undefined
      },
      getFieldInputValue : (fieldName) => {
        const fieldEntry = state.fieldData[fieldName]
        // as a UI component tied to 'input' elements, expect empty val as empty
        // string, not null, etc.
        return (fieldEntry && objToInputVal(fieldEntry.value)) || ''
      },
      updateFieldValue : (fieldName, value) => {
        if (!state.fieldData[fieldName] || state.fieldData[fieldName].value !== value) {dispatch(actions.updateField(fieldName, value))}
      },
      excludeFieldFromExport : (fieldName) =>
        dispatch(actions.excludeFieldFromExport(fieldName)),
      updateMatchingFields : (obj) => {
        Object.entries(obj).forEach(([key, value]) => {
          // we only update matching, 'plain' values
          if (state.fieldData[key]
              && typeof value !== 'object'
              && state.fieldData[key].value !== value) {
            dispatch(actions.updateField(key, value))
          }
        })
      },

      isChanged : () =>
        !isEqual(state.origData, exportDataFromFieldData(state.fieldData)),
      isValid : () =>
        !Object.values(state.fieldData).some((fieldEntry) => fieldEntry.errorMsg),

      isFieldTouched : (fieldName) =>
        state.fieldData[fieldName]
          ? state.fieldData[fieldName].touched
          : undefined,
      // We avoid 'onBlur' as that implies 'event' as the argument.
      blurField : (fieldName) => {
        if (!state.fieldData[fieldName]
            || !state.fieldData[fieldName].touched
            || !state.fieldData[fieldName].blurredAfterChange) {
          dispatch(actions.blurField(fieldName, updateCallback))
        }
      },

      updateFieldValidators : (fieldName, validators) => {
        if (!state.fieldData[fieldName] || !isEqual(state.fieldData[fieldName].validators, validators)) {dispatch(actions.updateFieldValidators(fieldName, validators))}
      },
      addContextValidator : (fieldName, validator, triggerFields) => {
        dispatch(actions.addContextValidator(fieldName, validator, triggerFields))
        return validator
      },
      removeContextValidator : (validator) => {
        dispatch(actions.removeContextValidator(validator))
      },

      // Error messages are only returned when the field is touched.
      getFieldErrorMessage : (fieldName) => {
        const fieldEntry = state.fieldData[fieldName]
        return (fieldEntry && fieldEntry.touched && fieldEntry.errorMsg) || null
      },

      getUndoCount : () => historyLength > 0 ? state.historyIndex : null,
      getRedoCount : () => historyLength > 0
        ? state.dataHistory.length - state.historyIndex - 1
        : null,
      getHistoryCount : () => historyLength > 0
        ? state.dataHistory.length
        : null,
      rewindData : (count=1) =>
        dispatch(actions.rewindData(count, updateCallback)),
      advanceData : (count=1) =>
        dispatch(actions.advanceData(count, updateCallback)),
      resetData : () => dispatch(actions.resetData(updateCallback)),

      resetHistory : () => dispatch(actions.resetHistory()),
    }

    return api
  }, [ state, dispatch, historyLength, updateCallback ])

  useEffect(() => {
    if (data === undefined && state.origData === undefined
        && Object.keys(exportDataFromFieldData(state.fieldData)).length > 0) {
      dispatch(actions.initialSnapshot())
    }
  }, [state.fieldData])

  return (
    <VContext.Provider value={api}>
      { children }
    </VContext.Provider>
  )
}

if (process.env.NODE_ENV !== 'production') {
  ValidationContext.propTypes = {
    children : PropTypes.oneOfType(
      [PropTypes.node, PropTypes.func]).isRequired,
    data           : PropTypes.object,
    historyLength  : PropTypes.number,
    resetHistory   : PropTypes.bool,
    updateCallback : PropTypes.func,
  }
}

export { ValidationContext, useValidationAPI }
