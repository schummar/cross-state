import { styled } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import React, { ElementType } from 'react';
import { FormDefinition } from '../../src/form/form';
type Model = {
  title?: string;
  description?: string;
  date?: Date;
  foo?: { bar?: { id: string }[] };
};

const exampleForm = new FormDefinition<Model>();

function App() {
  console.log('render App');

  return (
    <exampleForm.Provider value={{ title: 'a', foo: { bar: [] } }}>
      <Nested />
    </exampleForm.Provider>
  );
}

function Nested() {
  const [description] = exampleForm.useField('description');
  console.log('render Nested', description);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <exampleForm.Field name="description" component={TextField} label="foo" error helperText="foo" />

      <exampleForm.Field name="foo.bar" component="input" className="foo" />
    </div>
  );
}

styled;

export default App;

type A = { value?: string };
const x: ElementType<A> = 'input';
const y: ElementType<A> = TextField;
console.log(x, y);
