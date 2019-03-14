/* global afterAll beforeAll describe expect jest test */
import React from 'react'

import { ValidationContext, useValidationContextAPI } from '../utils/ValidationContext'
import { ValidInput } from './ValidInput'

import { cleanup, fireEvent, render } from 'react-testing-library'

const TestData = () => {
  const vcAPI = useValidationContextAPI()

  return (
    <div>
      <button aria-label="resetButton" onClick={() => vcAPI.resetData()}>reset</button>
      <button aria-label="rewindButton" onClick={() => vcAPI.rewindData()}>rewind</button>
      <button aria-label="advanceButton" onClick={() => vcAPI.advanceData()}>advance</button>
      <button aria-label="resetHistoryButton" onClick={() => vcAPI.resetHistory()}>reset history</button>
      <span data-testid="fooValue">{vcAPI.getFieldInputValue('foo') + ''}</span>
      <span data-testid="isChanged">{vcAPI.isChanged() + ''}</span>
      <span data-testid="isValid">{vcAPI.isValid() + ''}</span>
      <span data-testid="errorMsg">{vcAPI.getFieldErrorMessage('foo') + ''}</span>
      <span data-testid="undoCount">{vcAPI.getUndoCount() + ''}</span>
      <span data-testid="redoCount">{vcAPI.getRedoCount() + ''}</span>
      <span data-testid="origData">{JSON.stringify(vcAPI.getOrigData())}</span>
    </div>
  )
}

describe(`ValidInput`, () => {
  test('should raise an exception if used outside a ValidationContext', () => {
    const errMock = jest.spyOn(console, 'error').mockImplementation()
    expect(() => { render(<ValidInput value='foo' />); }).toThrow()
    errMock.mockReset()
  })

  describe('within a ValidationContext', () => {

    describe('taking a value as a property with no context data', () => {
      let getByLabelText, getByTestId, fooInput

      beforeAll(() => {
        ({ getByLabelText, getByTestId } = render(
          <ValidationContext>
            <ValidInput id="foo" label="foo" value="fooVal" />
            <TestData />
          </ValidationContext>
        ))
        fooInput = getByLabelText('foo');
      })

      test('will display the value', () => {
        expect(fooInput.value).toBe('fooVal')
      })

      test('update the value in the context', () => {
        expect(getByTestId('fooValue').textContent).toBe('fooVal')
      })

      describe('after updating the value', () => {
        beforeAll(() => { fireEvent.change(fooInput, { target : { value : 'foo2' } }) })

        test('will display the value', () => {
          expect(fooInput.value).toBe('foo2')
        })

        test('update the value in the context', () => {
          expect(getByTestId('fooValue').textContent).toBe('foo2')
        })

        describe('after blurring the field', () => {
          beforeAll(() => fireEvent.blur(fooInput))
          test("one 'undo' is available", () => {
            expect(getByTestId('undoCount').textContent).toBe('1')
          })
        }) // field blur
      }) // update
    }) // value as a property sequence

    describe('when gridded', () => {
      let container

      beforeAll(() => {
        ({ container } = render(
          <ValidationContext data={{ foo: 'fooVal' }}>
            <ValidInput id="foo" label="foo" gridded />
            <TestData />
          </ValidationContext>
        ))
      })

      test('the input is displayed in a grid item', () => {
        expect(container.querySelector("[class^='MuiGrid-item']")).not.toBeNull()
      })
    })
  }) // within a valid context
})