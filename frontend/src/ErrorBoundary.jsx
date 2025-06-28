import React from 'react';
import { Alert, Button, Card, Typography } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          maxWidth: '800px', 
          margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <ExclamationCircleOutlined 
                style={{ 
                  fontSize: '48px', 
                  color: '#ff4d4f',
                  marginBottom: '16px'
                }} 
              />
              <Title level={2} style={{ color: '#ff4d4f' }}>
                Something went wrong
              </Title>
            </div>

            <Alert
              message="Application Error"
              description={
                <div>
                  <Text>
                    The application encountered an unexpected error. This might be due to:
                  </Text>
                  <ul style={{ marginTop: '8px', marginBottom: '16px' }}>
                    <li>Missing component imports</li>
                    <li>JavaScript syntax errors</li>
                    <li>Network connectivity issues</li>
                    <li>Browser compatibility problems</li>
                  </ul>
                  {this.state.error && (
                    <details style={{ marginTop: '16px' }}>
                      <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
                        Error Details (for developers)
                      </summary>
                      <pre style={{ 
                        background: '#f5f5f5', 
                        padding: '12px', 
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '12px',
                        marginTop: '8px'
                      }}>
                        {this.state.error.toString()}
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              }
              type="error"
              showIcon
              style={{ marginBottom: '20px' }}
            />

            <div style={{ textAlign: 'center' }}>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
                size="large"
              >
                Reload Application
              </Button>
            </div>

            <div style={{ 
              marginTop: '20px', 
              textAlign: 'center',
              color: '#666',
              fontSize: '14px'
            }}>
              <Text>
                If the problem persists, please check the browser console for more details 
                or contact support.
              </Text>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 