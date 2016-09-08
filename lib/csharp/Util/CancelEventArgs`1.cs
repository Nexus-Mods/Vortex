using System.ComponentModel;

namespace Util
{
	/// <summary>
	/// Describes the arguments passed to a cancelable event.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public class CancelEventArgs<T> : CancelEventArgs
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
		public CancelEventArgs(T p_tArgument)
		{
			Argument = p_tArgument;
		}
	}
}
