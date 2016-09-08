using System;
using System.IO;
using System.Net;

namespace Util.WebInterface
{
	class HttpWebResponseWrapper : IHttpWebResponse
    {
        HttpWebResponse m_hwrWrapped;

        public HttpWebResponseWrapper(HttpWebResponse response)
        {
            m_hwrWrapped = response;
        }

        public WebHeaderCollection Headers
        {
            get
            {
                return m_hwrWrapped.Headers;
            }
        }

        public HttpStatusCode StatusCode
        {
            get
            {
                return m_hwrWrapped.StatusCode;
            }
        }

        public void Dispose()
        {
            m_hwrWrapped.Dispose();
        }

        public string GetResponseHeader(string headerName)
        {
            return m_hwrWrapped.GetResponseHeader(headerName);
        }

        public Stream GetResponseStream()
        {
            return m_hwrWrapped.GetResponseStream();
        }
    }

    class HttpWebRequestWrapper : IHttpWebRequest
    {
        HttpWebRequest m_hwrWrapped;

        public HttpWebRequestWrapper(Uri url)
        {
            m_hwrWrapped = (HttpWebRequest)HttpWebRequest.Create(url);
        }

        public bool AllowAutoRedirect
        {
            get
            {
                return m_hwrWrapped.AllowAutoRedirect;
            }

            set
            {
                m_hwrWrapped.AllowAutoRedirect = value;
            }
        }

        public CookieContainer CookieContainer
        {
            get
            {
                return m_hwrWrapped.CookieContainer;
            }

            set
            {
                m_hwrWrapped.CookieContainer = value;
            }
        }

        public WebHeaderCollection Headers
        {
            get
            {
                return m_hwrWrapped.Headers;
            }
        }

        public string Method
        {
            get
            {
                return m_hwrWrapped.Method;
            }

            set
            {
                m_hwrWrapped.Method = value;
            }
        }

        public string UserAgent
        {
            get
            {
                return m_hwrWrapped.UserAgent;
            }

            set
            {
                m_hwrWrapped.UserAgent = value;
            }
        }

        public void AddRange(int from, int to)
        {
            m_hwrWrapped.AddRange(from, to);
        }

        public IHttpWebResponse GetResponse()
        {
            return new HttpWebResponseWrapper((HttpWebResponse)m_hwrWrapped.GetResponse());
        }
    }

    public class WebRequestFactory : IWebRequestFactory
    {
        public IHttpWebRequest Create(Uri uri)
        {
            return new HttpWebRequestWrapper(uri);
        }
    }
}
