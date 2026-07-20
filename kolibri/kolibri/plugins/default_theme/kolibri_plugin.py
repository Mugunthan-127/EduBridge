from django.templatetags.static import static

from kolibri.core import theme_hook
from kolibri.plugins import KolibriPluginBase
from kolibri.plugins.hooks import register_hook


class DefaultThemePlugin(KolibriPluginBase):
    pass


@register_hook
class DefaultThemeHook(theme_hook.ThemeHook):
    @property
    def theme(self):
        return {
            "siteTitle": "EduBridge",
            "brandColors": {
                "primary": {
                    "v_100": "#e0e8ff",
                    "v_200": "#b3c6ff",
                    "v_300": "#809fff",
                    "v_400": "#4d78ff",
                    "v_500": "#1a51ff",
                    "v_600": "#0032cc"
                },
                "secondary": {
                    "v_100": "#e0f2e5",
                    "v_200": "#b3dfbe",
                    "v_300": "#80ca96",
                    "v_400": "#4db46e",
                    "v_500": "#2e8540",
                    "v_600": "#1a4f26"
                }
            },
            "appBar": {
                "background": "#1a51ff",
                "textColor": "#ffffff"
            },
            "sideNav": {
                "title": "EduBridge",
                "showKolibriFooterLogo": False,
                "brandedFooter": {
                    "logo": {
                        "src": static("assets/default_theme/edubridge_logo.png"),
                        "alt": "EduBridge Logo",
                        "style": "margin-bottom: 5px; width: 77px; height: 77px;",
                    }
                }
            },
            "signIn": {
                "background": static("assets/default_theme/background.jpg"),
                "backgroundImgCredit": "Lewa Wildlife Conservancy",
                "showTitle": True,
                "title": "EduBridge",
                "topLogo": {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "alt": "EduBridge",
                    "style": "margin-bottom: 10px; width: 70px; height: 70px;",
                },
                "titleStyle": {"fontWeight": "700", "fontSize": "24px"},
            },
            "logos": [
                {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "content_type": "image/vnd.microsoft.icon",
                    "size": "32x32",
                },
                {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "content_type": "image/png",
                    "size": "32x32",
                },
                {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "content_type": "image/png",
                    "maskable": False,
                    "size": "any",
                },
                {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "content_type": "image/png",
                    "size": "192x192",
                },
                {
                    "src": static("assets/default_theme/edubridge_logo.png"),
                    "content_type": "image/png",
                    "size": "512x512",
                },
            ],
        }
