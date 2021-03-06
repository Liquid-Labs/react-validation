/* global afterAll beforeAll describe expect jest test */
import React from 'react'
import PropTypes from 'prop-types'

import { ValidationContext, useValidationAPI } from './ValidationContext'

import { cleanup, fireEvent, render } from 'react-testing-library'
import isEqual from 'lodash.isequal'

const TestChild = ({validators}) => {
  const vcAPI = useValidationAPI()
  if (validators) {
    vcAPI.updateFieldValidators('foo', validators)
  }
  return (
    <div>
      <input aria-label="foo" name="foo"
          onChange={(event) => vcAPI.updateFieldValue('foo', event.target.value)}
          onBlur={(event) => vcAPI.blurField('foo')}
          value={vcAPI.getFieldInputValue('foo')} />
      <button aria-label="resetButton" onClick={() => vcAPI.resetData()}>reset</button>
      <button aria-label="rewindButton" onClick={() => vcAPI.rewindData()}>rewind</button>
      <button aria-label="advanceButton" onClick={() => vcAPI.advanceData()}>advance</button>
      <button aria-label="resetHistoryButton" onClick={() => vcAPI.resetHistory()}>reset history</button>
      <button aria-label="addContextValidatorButton"
          onClick={() => vcAPI.addContextValidator('foo', (data) => data.foo === 'baz' ? 'No baz!' : null, ['foo'])}>
        add context validator
      </button>
      <span data-testid="isChanged">{vcAPI.isChanged() + ''}</span>
      <span data-testid="isValid">{vcAPI.isValid() + ''}</span>
      <span data-testid="errorMsg">{vcAPI.getFieldErrorMessage('foo') + ''}</span>
      <span data-testid="undoCount">{vcAPI.getUndoCount() + ''}</span>
      <span data-testid="redoCount">{vcAPI.getRedoCount() + ''}</span>
      <span data-testid="historyCount">{vcAPI.getHistoryCount() + ''}</span>
      <span data-testid="origData">{JSON.stringify(vcAPI.getOrigData())}</span>
    </div>
  )
}

TestChild.propTypes = {
  validators : PropTypes.arrayOf(PropTypes.func)
}

const testValidators = [
  (value) => value === '' ? "Required." : null,
  (value) => value === 'bar' ? "No bar!" : null,
]

const setupWarningSpy = () => {
  const warningSpy = jest.spyOn(console, 'warn').mockImplementation()
  // Even though 'warningSpy' is new, jest appareantly reconizes the previous
  // mock and preseves it, so we have to clear it.
  warningSpy.mockClear()

  return warningSpy
}

const stdSetup = ({origData, validators, ...props}) => {
  origData = origData || { foo : 'foo', bar : 'bar' }
  const warningSpy = setupWarningSpy()

  const dataEnvelope = {}
  dataEnvelope.data = Object.assign({}, origData)
  const updateCallback = jest.fn((newData) => {
    dataEnvelope.data = newData
  })
  const renderAPI = render(
    <ValidationContext data={dataEnvelope.data} updateCallback={updateCallback} {...props}>
      <TestChild validators={validators} />
    </ValidationContext>
  )

  const fooInput = renderAPI.getByLabelText('foo')

  return {
    dataEnvelope,
    fooInput,
    origData,
    updateCallback,
    warningSpy,
    ...renderAPI,
  }
}

describe('ValidationContext', () => {
  [['with no initial field validators', undefined],
    ['with initial field validators', testValidators]].forEach(([desc, validators]) => {
    describe(desc, () => {
      let dataEnvelope, fooInput, warningSpy,
        getByTestId, getByLabelText,
        origData, updateCallback;

      beforeAll(() => {
        ({ dataEnvelope, fooInput, warningSpy,
          getByTestId, getByLabelText,
          origData, updateCallback } = stdSetup({validators}))
      })

      afterAll(cleanup)

      describe('should initially', () =>{
        test('be unchaned', () => {
          expect(getByTestId("isChanged").textContent).toBe('false')
        })

        test('not call the update callback', () => {
          expect(updateCallback).toHaveBeenCalledTimes(0)
        })

        test(`display the 'origData'`, () => {
          expect(JSON.stringify(dataEnvelope.data)).toBe(getByTestId('origData').textContent)
        })
      })

      describe('on field change', () => {
        beforeAll(() =>
          fireEvent.change(fooInput, { target : { value : 'foo2' } }))

        test("should indicate 'isChanged'", () => {
          expect(getByTestId("isChanged").textContent).toBe('true')
        })

        test("reflect change to input", () => {
          expect(fooInput.value).toBe('foo2')
        })

        test("should not invoke 'updateCallback'", () => {
          expect(updateCallback).toHaveBeenCalledTimes(0)
        })

        test("should not change the 'origData'", () => {
          expect(isEqual(origData, dataEnvelope.data)).toBe(true)
        })

        describe('after blur', () => {
          beforeAll(() => {
            fireEvent.blur(fooInput)
          })

          test("should have 1 undo available", () => {
            expect(getByTestId('undoCount').textContent).toBe('1')
          })

          describe("after stepping back in history", () => {
            beforeAll(() => {
              fireEvent.click(getByLabelText('rewindButton'))
            })

            test("should display previous value", () => {
              expect(fooInput.value).toBe('foo')
            })

            test("should have 0 undo available", () => {
              expect(getByTestId('undoCount').textContent).toBe('0')
            })

            test("should have 1 redo available", () => {
              expect(getByTestId('undoCount').textContent).toBe('0')
            })

            test("should have updated external data (through callback)", () => {
              expect(dataEnvelope.data.foo).toBe('foo')
            })

            test(`should not have triggered warnings`, () => {
              expect(warningSpy).toHaveBeenCalledTimes(0)
            })

            test(`should not change the 'origData'`, () => {
              expect(JSON.stringify(dataEnvelope.data)).toBe(getByTestId('origData').textContent)
            })

            describe("after stepping forward in history", () => {
              beforeAll(() => {
                fireEvent.click(getByLabelText('advanceButton'))
              })

              test("should display future value", () => {
                expect(fooInput.value).toBe('foo2')
              })

              test("should have 1 undo available", () => {
                expect(getByTestId('undoCount').textContent).toBe('1')
              })

              test("should have 0 redo available", () => {
                expect(getByTestId('redoCount').textContent).toBe('0')
              })

              test(`should not have triggered warnings`, () => {
                expect(warningSpy).toHaveBeenCalledTimes(0)
              })
            })
          })
        })
      })

      test(`should not have triggered warnings`, () => {
        expect(warningSpy).toHaveBeenCalledTimes(0)
      })

      describe('with no data', () => {
        let getByLabelText, warningSpy;

        beforeAll(() => {
          cleanup();
          warningSpy = setupWarningSpy();
          const updateCallback = jest.fn();
          ({getByLabelText} = render(
            <ValidationContext updateCallback={updateCallback}>
              <TestChild validators={validators} />
            </ValidationContext>
          ))
        })
        afterAll(cleanup)

        test("can be created without a 'data' property", () => {
          expect(getByLabelText('foo').value).toBe('')
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })

      describe('after no-change edit and blur', () => {
        let dataEnvelope, fooInput, warningSpy,
          origData, updateCallback

        beforeAll(() => {
          ({ dataEnvelope, fooInput, warningSpy,
            origData, updateCallback } = stdSetup({validators}))

          fireEvent.change(fooInput, { target : { value : 'foo2' } })
          fireEvent.change(fooInput, { target : { value : 'foo' } })
          fireEvent.blur(fooInput)
        })

        afterAll(cleanup)

        test("should not invoke callback", () => {
          expect(updateCallback).toHaveBeenCalledTimes(0)
        })

        test("'origData' should equal local reference", () => {
          expect(origData).toEqual(dataEnvelope.data)
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })

      describe('after external data change with default settings', () => {
        let fooInput, dataEnvelope, updateCallback,
          getByTestId, rerender

        beforeAll(() => {
          ({ fooInput, dataEnvelope, updateCallback,
            getByTestId, rerender } =
            stdSetup({validators}))
          dataEnvelope.data = { foo : 'foo3' }
          rerender(
            <ValidationContext data={dataEnvelope.data} updateCallback={updateCallback}>
              <TestChild validators={validators} />
            </ValidationContext>
          )
        })

        afterAll(cleanup)

        test("will reflect change", () => {
          expect(fooInput.value).toBe('foo3')
        })

        test("will reset history", () => {
          expect(getByTestId('undoCount').textContent).toBe('0')
          expect(getByTestId('redoCount').textContent).toBe('0')
        })

        test(`should trigger reset warning`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(1)
          expect(warningSpy).toHaveBeenCalledWith(`Programatic update of data detected. Form history will be reset.`)
        })
      })

      describe("after external data change with 'historyLength={0}'", () => {
        let fooInput, dataEnvelope, updateCallback,
          getByLabelText, getByTestId, rerender

        beforeAll(() => {
          ({ fooInput, dataEnvelope, updateCallback,
            getByLabelText, getByTestId, rerender } =
            stdSetup({validators, historyLength : 0}))
          dataEnvelope.data = { foo : 'foo3' }
          rerender(
            <ValidationContext data={dataEnvelope.data} updateCallback={updateCallback} historyLength={0}>
              <TestChild validators={validators} />
            </ValidationContext>
          )
        })

        afterAll(cleanup)

        test("will reflect change", () => {
          expect(fooInput.value).toBe('foo3')
        })

        test("will have no history", () => {
          expect(getByTestId('undoCount').textContent).toBe('null')
          expect(getByTestId('redoCount').textContent).toBe('null')
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })

        describe(`history is reset`, () => {
          beforeAll(() => {
            fireEvent.click(getByLabelText('resetHistoryButton'))
          })

          test("will have no history", () => {
            expect(getByTestId('undoCount').textContent).toBe('null')
            expect(getByTestId('redoCount').textContent).toBe('null')
          })
        })
      })

      describe("after external data change with 'resetHistory'", () => {
        let fooInput, dataEnvelope, updateCallback,
          getByTestId, rerender

        beforeAll(() => {
          cleanup();
          ({ fooInput, dataEnvelope, updateCallback,
            getByTestId, rerender } =
            stdSetup({validators}))
          dataEnvelope.data = { foo : 'foo3' }
          rerender(
            <ValidationContext data={dataEnvelope.data} updateCallback={updateCallback} resetHistory>
              <TestChild validators={validators} />
            </ValidationContext>
          )
        })

        test("will reflect change", () => {
          expect(fooInput.value).toBe('foo3')
        })

        test("will reset history", () => {
          expect(getByTestId('undoCount').textContent).toBe('0')
          expect(getByTestId('redoCount').textContent).toBe('0')
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })

      describe("with reset to original data", () => {
        let fooInput, warningSpy, getByLabelText

        beforeAll(() => {
          cleanup();
          ({ fooInput, warningSpy, getByLabelText } =
            stdSetup({validators}))
          fireEvent.change(fooInput, { target : { value : 'foo2' } })
          fireEvent.blur(fooInput)
          const resetButton = getByLabelText('resetButton')
          fireEvent.click(resetButton)
        })

        test(`should display original values`, () => {
          expect(fooInput.value).toBe('foo')
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })

      describe('with context validators added to valid data', () => {
        let fooInput, getByTestId, warningSpy
        beforeAll(() => {
          cleanup();
          ({ fooInput, getByTestId, warningSpy } =
            stdSetup({ validators, origData : { foo : 'foo' } }));
          fireEvent.click(getByLabelText('addContextValidatorButton'))
        })

        test(`should display initial values with no error`, () => {
          expect(fooInput.value).toBe('foo')
          expect(getByTestId('errorMsg').textContent).toBe('null')
        })

        describe('with bad value and field blurred', () => {
          beforeAll(() => {
            fireEvent.change(fooInput, { target : { value : 'baz' } })
            fireEvent.blur(fooInput)
          })

          test('will generate context error', () => {
            expect(getByTestId('errorMsg').textContent).toBe('No baz!')
          })
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })

      describe('with context validators added to invalid data', () => {
        let fooInput, getByTestId, warningSpy
        beforeAll(() => {
          cleanup();
          ({ fooInput, getByTestId, warningSpy } =
            stdSetup({ validators, origData : { foo : 'baz' } }));
          fireEvent.click(getByLabelText('addContextValidatorButton'))
        })

        test(`should display initial values with no error`, () => {
          expect(fooInput.value).toBe('baz')
          expect(getByTestId('errorMsg').textContent).toBe('null')
        })

        describe('with field blurred', () => {
          beforeAll(() => {
            fireEvent.blur(fooInput)
          })

          test('will generate context error', () => {
            expect(getByTestId('errorMsg').textContent).toBe('No baz!')
          })
        })

        test(`should not have triggered warnings`, () => {
          expect(warningSpy).toHaveBeenCalledTimes(0)
        })
      })
    }) // validators variation describe
  }) // validators variation loop

  describe("with initially invalid fields", () => {
    let fooInput, getByTestId, warningSpy
    beforeAll(() => {
      ({ fooInput, getByTestId, warningSpy } =
        stdSetup({ validators : testValidators, origData : { foo : null } }))
    })

    test('should not produce errors on invalid, untouched fields', () => {
      expect(getByTestId("errorMsg").textContent).toBe('null')
    })

    test('should be invalid', () => {
      expect(getByTestId("isValid").textContent).toBe('false')
    })

    describe("after blur", () => {
      beforeAll(() => {
        fireEvent.blur(fooInput)
      })

      test('should produce errors', () => {
        expect(getByTestId("errorMsg").textContent).toBe('Required.')
      })

      test('should be invalid', () => {
        expect(getByTestId("isValid").textContent).toBe('false')
      })
    })

    test(`should not have triggered warnings`, () => {
      expect(warningSpy).toHaveBeenCalledTimes(0)
    })
  }) // with initially invalid fields
}) // describe('Validators', ...)

//  reset of forward history after update, and no reset after non-change change (edit, and then edit back without blur)
