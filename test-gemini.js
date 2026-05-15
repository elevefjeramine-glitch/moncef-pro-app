const apiKey = 'AIzaSyCc7dpIU3mESplSSSfWKHssXkKgGiW_NRw';

async function testGemini() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
}

testGemini();
