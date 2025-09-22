async function forgotPassword(email) {
  try {
    const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    console.log('Forgot password response:', data);
    alert(data.message);
  } catch (error) {
    console.error('Forgot password error:', error);
    alert('Error sending password reset request');
  }
}

async function resetPassword(token, password) {
  try {
    const response = await fetch('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, password })
    });
    const data = await response.json();
    console.log('Reset password response:', data);
    alert(data.message);
  } catch (error) {
    console.error('Reset password error:', error);
    alert('Error resetting password');
  }
}