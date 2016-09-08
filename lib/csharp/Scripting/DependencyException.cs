using System;

namespace Scripting
{
	/// <summary>
	/// An exception class that represents a dependency that was not fufilled.
	/// </summary>
	[Serializable]
	public class DependencyException : ApplicationException
	{
		/// <summary>
		/// The default constructor.
		/// </summary>
		public DependencyException()
		{
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		public DependencyException(string message)
			: base(message)
		{
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		/// <param name="inner">The ineer exception.</param>
		public DependencyException(string message, Exception inner)
			: base(message, inner)
		{
		}
	}
}
