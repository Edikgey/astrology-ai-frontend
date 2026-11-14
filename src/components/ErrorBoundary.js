import React from 'react';
import {reportSiteError} from '../analytics/reporting';

// Around the routes only: header, footer and the cookie banner stay on screen when a page crashes.
export default class ErrorBoundary extends React.Component {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  componentDidCatch(error) {reportSiteError('render', error);}
  render() {
    return this.state.failed
      ? <div className="notice shell" role="alert">Не удалось показать страницу. Обновите её; если ошибка повторится — напишите в поддержку.</div>
      : this.props.children;
  }
}
