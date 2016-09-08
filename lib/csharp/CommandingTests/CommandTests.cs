using System;
using System.ComponentModel;
using Xunit;

namespace Commands.Tests
{
	public class CommandTests
	{
		[Fact]
		public void CommandTriggersEvents()
		{
			bool before = false;
			bool after = false;
			bool ran = false;

			Command cmd = new Command("name", "description", () => { ran = true; });
			cmd.BeforeExecute += (object sender, CancelEventArgs args) => { before = true; };
			cmd.Executed += (object sender, EventArgs args) => { after = true; };
			cmd.Execute();

			Assert.True(before);
			Assert.True(after);
			Assert.True(ran);
		}

		[Fact]
		public void CommandCanCancel()
		{
			bool before = false;
			bool after = false;
			bool ran = false;

			Command cmd = new Command("name", "description", () => { ran = true; });
			cmd.BeforeExecute += (object sender, CancelEventArgs args) => { before = true; args.Cancel = true; };
			cmd.Executed += (object sender, EventArgs args) => { after = true; };
			cmd.Execute();

			Assert.True(before);
			Assert.False(after);
			Assert.False(ran);
		}
	}
}