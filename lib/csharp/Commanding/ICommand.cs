using System.ComponentModel;

namespace Commands
{
	/// <summary>
	/// The interface for commands.
	/// </summary>
	public interface ICommand : INotifyPropertyChanged
	{
		/// <summary>
		/// Gets the name of the command.
		/// </summary>
		/// <value>The name of the command.</value>
		string Name { get; }

		/// <summary>
		/// Gets the description of the command.
		/// </summary>
		/// <value>The description of the command.</value>
		string Description { get; }

		/// <summary>
		/// Gets or sets whether the command can be executed.
		/// </summary>
		/// <value>Whether the command can be executed.</value>
		bool CanExecute { get; set; }
	}
}
