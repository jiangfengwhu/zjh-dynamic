import { Component, type ComponentType } from "react";
import { type FeedCardProps } from "../../../../../packages/ui/feed";
import { PixelPostFrame } from "./PixelPostFrame";

type Props = {
  card: FeedCardProps;
  /** 朋友为这一类动态登记的整张卡。没有登记就用默认的卡。 */
  Template?: ComponentType<FeedCardProps>;
};

type State = { failed: boolean };

/**
 * 一张动态卡的位置。朋友登记了卡片就由朋友画整张；
 * 朋友的卡片画崩了，只替换这一张成默认的卡，其余的动态照常显示。
 */
export class CardSlot extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      "feed card failed",
      this.props.card.friend.id,
      this.props.card.post.kind,
      message.slice(0, 200)
    );
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.Template !== this.props.Template)
      this.setState({ failed: false });
  }

  render() {
    const { card, Template } = this.props;
    if (Template && !this.state.failed) return <Template {...card} />;
    return <PixelPostFrame {...card} />;
  }
}
