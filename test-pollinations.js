async function testPollinations() {
  const response = await fetch(`https://text.pollinations.ai/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ]
    })
  });
  const data = await response.text();
  console.log(data);
}

testPollinations();
