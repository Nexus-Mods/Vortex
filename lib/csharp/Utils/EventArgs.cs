using System;

namespace Utils
{
	/// <summary>
	/// Describes the arguments passed to an event.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public class EventArgs<T> : EventArgs
	{
		/// <summary>
		/// Gets or sets the argument.
		/// </summary>
		/// <value>The argument.</value>
		public T Argument { get; protected set; }

		/// <summary>
		/// A simple contructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_tArgument">The argument.</param>
		public EventArgs(T p_tArgument)
		{
			Argument = p_tArgument;
		}
	}
}
