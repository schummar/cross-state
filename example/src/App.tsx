import TextField from '@material-ui/core/TextField';
import React, { useEffect, useState } from 'react';
import { Form } from '../../src/form';
type Model = Partial<{
  title: string;
  description: string;
  date: Date;
}>;

const exampleForm = new Form<Model>();

function App() {
  console.log('render App');

  return (
    <exampleForm.Provider value={{ title: 'a' }}>
      <Nested />
    </exampleForm.Provider>
  );
}

function Nested() {
  const [title, setTitle] = exampleForm.useField('title');
  console.log('render Nested');

  return (
    <div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />

      <exampleForm.Field name="description">{(props) => <TextField {...props} variant="filled" />}</exampleForm.Field>

      <exampleForm.Field name="date">{(props) => <TextField {...props} variant="filled" />}</exampleForm.Field>
    </div>
  );
}

export default App;
